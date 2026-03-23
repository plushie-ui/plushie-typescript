// App rating page for Plushie.
//
// Demonstrates custom canvas widgets (starRating, themeToggle) composed
// with styled containers using the full function API. The "Dark humor"
// toggle animates the emoji and flips the entire page theme.
//
// Demonstrates:
// - Canvas-based star rating (interactive)
// - Theme toggle with animation
// - Review list with star ratings
// - Review submission form
// - Theme interpolation (light to dark)

import { app, Subscription, isClick, isInput, isSubmit, isTimer, isWidget } from '../src/index.js'
import type { Event, UINode } from '../src/index.js'
import { window, column, row, text, button, textInput, textEditor, container, rule, space } from '../src/ui/index.js'
import { starRating } from './widgets/star_rating.js'
import { themeToggle } from './widgets/theme_toggle.js'

// -- Types --------------------------------------------------------------------

interface Review {
  stars: number
  user: string
  time: string
  text: string
}

interface Model {
  rating: number
  hoverStar: number | null
  focusedStar: number | null
  toggleProgress: number
  toggleTarget: number
  reviews: Review[]
  reviewName: string
  reviewComment: string
}

interface Theme {
  pageBg: string
  cardBg: string
  cardBorder: string
  text: string
  textSecondary: string
  textMuted: string
}

// -- Constants ----------------------------------------------------------------

const INITIAL_REVIEWS: Review[] = [
  { stars: 5, user: "elixir_fan_42", time: "2d ago",
    text: "Finally, native GUIs that don't make me want to cry." },
  { stars: 5, user: "beam_me_up", time: "3d ago",
    text: "The Elm architecture feels right at home here." },
  { stars: 4, user: "rustacean", time: "5d ago",
    text: "Solid Iced wrapper. Docked a star because I had to write Elixir." },
  { stars: 3, user: "web_refugee", time: "1w ago",
    text: "Where is my CSS grid? Also it works perfectly. Three stars." },
  { stars: 5, user: "otp_enjoyer", time: "1w ago",
    text: "Let it crash, but make it beautiful." },
  { stars: 1, user: "electron_mass", time: "2w ago",
    text: "No browser engine. No JavaScript runtime. What am I even paying for?" },
]

// -- Theme interpolation ------------------------------------------------------

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
}

function fade(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): string {
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`
}

function smoothstep(t: number): number {
  if (t <= 0.0) return 0.0
  if (t >= 1.0) return 1.0
  return t * t * (3 - 2 * t)
}

function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target)
  if (current > target) return Math.max(current - step, target)
  return current
}

function buildTheme(p: number): Theme {
  return {
    pageBg: fade(248, 248, 250, 19, 19, 31, p),
    cardBg: fade(255, 255, 255, 28, 28, 50, p),
    cardBorder: fade(224, 224, 224, 42, 42, 74, p),
    text: fade(26, 26, 26, 240, 240, 245, p),
    textSecondary: fade(102, 102, 102, 153, 153, 187, p),
    textMuted: fade(170, 170, 170, 85, 85, 119, p),
  }
}

// -- Helpers ------------------------------------------------------------------

function submitReview(model: Model): Model {
  const name = model.reviewName.trim()
  const comment = model.reviewComment.trim()

  if (name !== "" && comment !== "" && model.rating > 0) {
    const review: Review = { stars: model.rating, user: name, time: "just now", text: comment }
    return { ...model, reviews: [review, ...model.reviews], reviewName: "", reviewComment: "", rating: 0 }
  }
  return model
}

// -- View helpers -------------------------------------------------------------

function reviewForm(model: Model): UINode {
  return column({ id: "review-form", spacing: 12, width: "fill" }, [
    textInput("review-name", model.reviewName, { placeholder: "Your name" }),
    textEditor("review-comment", {
      content: model.reviewComment,
      placeholder: "Write your review...",
      height: 80,
    }),
    button("submit-review", "Submit Review"),
  ])
}

function themeRow(model: Model, t: Theme): UINode {
  return row({ id: "theme-row", alignY: "center" }, [
    space({ id: "theme-spacer", width: "fill" }),
    text("toggle-label", "Dark humor", { color: t.textSecondary }),
    themeToggle("theme-toggle", model.toggleProgress),
  ])
}

function ratingCard(model: Model, p: number, t: Theme): UINode {
  return container("rating-card", {
    padding: 24,
    width: "fill",
    border: { width: 1, color: t.cardBorder, radius: 12 },
    background: t.cardBg,
  }, [
    column({ spacing: 20 }, [
      text("prompt", "How would you rate Plushie?", { size: 14, color: t.textSecondary }),

      starRating("stars", model.rating, {
        hover: model.hoverStar,
        focused: model.focusedStar,
        themeProgress: p,
      }),

      rule(),
      reviewForm(model),
      themeRow(model, t),
    ]),
  ])
}

function reviewCard(review: Review, i: number, p: number, t: Theme): UINode {
  return column({ id: `review-${i}`, spacing: 4, padding: 12, width: "fill" }, [
    row({ id: `rhdr-${i}`, spacing: 8, alignY: "center" }, [
      starRating(`rstars-${i}`, review.stars, { readonly: true, scale: 0.4, themeProgress: p }),
      text(`rname-${i}`, review.user, { size: 12, color: t.textSecondary }),
      space({ id: `rsp-${i}`, width: "fill" }),
      text(`rtime-${i}`, review.time, { size: 12, color: t.textMuted }),
    ]),
    text(`rtext-${i}`, `\u201C${review.text}\u201D`, { size: 14, color: t.text }),
  ])
}

function reviewsList(reviews: Review[], p: number, t: Theme): UINode {
  const children: UINode[] = []
  reviews.forEach((review, i) => {
    if (i > 0) children.push(rule({ id: `sep-${i}` }))
    children.push(reviewCard(review, i, p, t))
  })

  return column({ id: "reviews", spacing: 0, width: "fill" }, children)
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  // -- Init -------------------------------------------------------------------

  init: {
    rating: 0,
    hoverStar: null,
    focusedStar: null,
    toggleProgress: 0.0,
    toggleTarget: 0.0,
    reviews: INITIAL_REVIEWS,
    reviewName: "",
    reviewComment: "",
  },

  // -- Subscribe --------------------------------------------------------------

  subscriptions: (s) => {
    if (s.toggleProgress !== s.toggleTarget) {
      return [Subscription.every(16, "animate")]
    }
    return []
  },

  // -- Update -----------------------------------------------------------------

  update(state, event: Event) {
    // Star rating interactions
    if (isWidget(event) && event.id === "stars") {
      if (event.type === "canvas_shape_click" && event.data?.["shape_id"]) {
        const match = String(event.data["shape_id"]).match(/^star-(\d+)$/)
        if (match) return { ...state, rating: Number(match[1]) + 1 }
      }
      if (event.type === "canvas_shape_enter" && event.data?.["shape_id"]) {
        const match = String(event.data["shape_id"]).match(/^star-(\d+)$/)
        if (match) return { ...state, hoverStar: Number(match[1]) + 1 }
      }
      if (event.type === "canvas_shape_leave") {
        return { ...state, hoverStar: null }
      }
      if (event.type === "canvas_shape_focused" && event.data?.["shape_id"]) {
        const match = String(event.data["shape_id"]).match(/^star-(\d+)$/)
        if (match) return { ...state, focusedStar: Number(match[1]) }
      }
    }

    // Theme toggle
    if (isWidget(event) && event.id === "theme-toggle" && event.type === "canvas_shape_click") {
      const target = state.toggleTarget === 0.0 ? 1.0 : 0.0
      return { ...state, toggleTarget: target }
    }

    // Review form
    if (isInput(event, "review-name")) return { ...state, reviewName: String(event.value) }
    if (isInput(event, "review-comment")) return { ...state, reviewComment: String(event.value) }
    if (isClick(event, "submit-review")) return submitReview(state)
    if (isSubmit(event, "review-name")) return submitReview(state)

    // Animation
    if (isTimer(event, "animate")) {
      return { ...state, toggleProgress: approach(state.toggleProgress, state.toggleTarget, 0.06) }
    }

    return state
  },

  // -- View -------------------------------------------------------------------

  view: (s) => {
    const p = smoothstep(s.toggleProgress)
    const t = buildTheme(p)

    return window("main", { title: "Rate Plushie" }, [
      container("page", {
        padding: { top: 32, bottom: 32, left: 24, right: 24 },
        background: t.pageBg,
        width: "fill",
        height: "fill",
      }, [
        column({ spacing: 24, width: "fill" }, [
          text("heading", "Rate Plushie", { size: 28, color: t.text }),
          ratingCard(s, p, t),
          text("reviews-heading", "Reviews", { size: 20, color: t.text }),
          reviewsList(s.reviews, p, t),
        ]),
      ]),
    ])
  },
})
