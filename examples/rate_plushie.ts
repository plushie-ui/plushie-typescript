// App rating page for Plushie.
//
// Demonstrates custom widget handlers (starRating, themeToggle) composed
// with styled containers using the full function API. The "Dark humor"
// toggle animates the emoji and flips the entire page theme.
//
// The review form showcases form validation with:
// - Per-field error state tracked in the model
// - Visual error styling via StyleMap (border + background tint)
// - Accessible error wiring via a11y (required, invalid, errorMessage)
// - Validate-on-submit with clear-on-change for responsive UX
//
// Demonstrates:
// - Canvas-based star rating (interactive radio group)
// - Theme toggle with internal animation
// - Review list with star ratings
// - Review submission form with validation
// - Theme interpolation (light to dark)
// - Accessibility (heading roles, form labels, radio group)

import type { Event, UINode } from "../src/index.js";
import { app, isClick, isInput, isSubmit, isWidget } from "../src/index.js";
import {
  button,
  column,
  container,
  row,
  rule,
  space,
  text,
  textEditor,
  textInput,
  window,
} from "../src/ui/index.js";
import type { StyleMap } from "../src/ui/types.js";
import { starRating } from "./widgets/star_rating.js";
import { themeToggle } from "./widgets/theme_toggle.js";

// -- Types --------------------------------------------------------------------

interface Review {
  stars: number;
  user: string;
  time: string;
  text: string;
}

interface Errors {
  name?: string;
  comment?: string;
  rating?: string;
}

interface Model {
  rating: number;
  darkMode: boolean;
  reviews: Review[];
  reviewName: string;
  reviewComment: string;
  errors: Errors;
}

interface Theme {
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  errorText: string;
  errorBorder: string;
  errorBg: string;
}

// -- Constants ----------------------------------------------------------------

const INITIAL_REVIEWS: Review[] = [
  {
    stars: 5,
    user: "elixir_fan_42",
    time: "2d ago",
    text: "Finally, native GUIs that don't make me want to cry.",
  },
  {
    stars: 5,
    user: "beam_me_up",
    time: "3d ago",
    text: "The Elm architecture feels right at home here.",
  },
  {
    stars: 4,
    user: "rustacean",
    time: "5d ago",
    text: "Solid Iced wrapper. Docked a star because I had to write Elixir.",
  },
  {
    stars: 3,
    user: "web_refugee",
    time: "1w ago",
    text: "Where is my CSS grid? Also it works perfectly. Three stars.",
  },
  { stars: 5, user: "otp_enjoyer", time: "1w ago", text: "Let it crash, but make it beautiful." },
  {
    stars: 1,
    user: "electron_mass",
    time: "2w ago",
    text: "No browser engine. No JavaScript runtime. What am I even paying for?",
  },
];

// -- Theme interpolation ------------------------------------------------------

function hexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

function fade(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  t: number,
): string {
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

function buildTheme(p: number): Theme {
  return {
    pageBg: fade(248, 248, 250, 19, 19, 31, p),
    cardBg: fade(255, 255, 255, 28, 28, 50, p),
    cardBorder: fade(224, 224, 224, 42, 42, 74, p),
    text: fade(26, 26, 26, 240, 240, 245, p),
    textSecondary: fade(102, 102, 102, 153, 153, 187, p),
    textMuted: fade(170, 170, 170, 85, 85, 119, p),
    errorText: fade(185, 28, 28, 255, 100, 100, p),
    errorBorder: fade(220, 38, 38, 255, 80, 80, p),
    errorBg: fade(254, 242, 242, 50, 20, 20, p),
  };
}

// -- Validation ---------------------------------------------------------------

function validateReview(model: Model): Errors {
  const errors: Errors = {};
  if (model.reviewName.trim() === "") errors.name = "Name is required";
  if (model.reviewComment.trim() === "") errors.comment = "Review text is required";
  if (model.rating <= 0) errors.rating = "Please select a rating";
  return errors;
}

function inputStyle(error: string | undefined, t: Theme): StyleMap | undefined {
  if (!error) return undefined;
  return {
    border: { width: 2, color: t.errorBorder, radius: 4 },
    background: t.errorBg,
    focused: {
      border: { width: 2, color: t.errorBorder, radius: 4 },
    },
  };
}

// -- Helpers ------------------------------------------------------------------

function submitReview(model: Model): Model {
  const errors = validateReview(model);

  if (Object.keys(errors).length === 0) {
    const name = model.reviewName.trim();
    const comment = model.reviewComment.trim();
    const review: Review = { stars: model.rating, user: name, time: "just now", text: comment };
    return {
      ...model,
      reviews: [review, ...model.reviews],
      reviewName: "",
      reviewComment: "",
      rating: 0,
      errors: {},
    };
  }
  return { ...model, errors };
}

// -- View helpers -------------------------------------------------------------

function reviewForm(model: Model, t: Theme): UINode {
  return column({ id: "review-form", spacing: 12, width: "fill" }, [
    column({ id: "name-field", spacing: 4, width: "fill" }, [
      textInput("review-name", model.reviewName, {
        placeholder: "Your name",
        onSubmit: true,
        style: inputStyle(model.errors.name, t),
        a11y: {
          label: "Your name",
          required: true,
          invalid: model.errors.name !== undefined,
          errorMessage: model.errors.name ? "review-name-error" : undefined,
        },
      }),
      ...(model.errors.name
        ? [
            text("review-name-error", model.errors.name, {
              size: 12,
              color: t.errorText,
              a11y: { role: "alert", live: "polite" },
            }),
          ]
        : []),
    ]),
    column({ id: "comment-field", spacing: 4, width: "fill" }, [
      textEditor("review-comment", {
        content: model.reviewComment,
        placeholder: "Write your review...",
        height: 80,
        style: inputStyle(model.errors.comment, t),
        a11y: {
          label: "Review text",
          required: true,
          invalid: model.errors.comment !== undefined,
          errorMessage: model.errors.comment ? "review-comment-error" : undefined,
        },
      }),
      ...(model.errors.comment
        ? [
            text("review-comment-error", model.errors.comment, {
              size: 12,
              color: t.errorText,
              a11y: { role: "alert", live: "polite" },
            }),
          ]
        : []),
    ]),
    button("submit-review", "Submit Review"),
  ]);
}

function themeRow(t: Theme): UINode {
  return row({ id: "theme-row", alignY: "center" }, [
    space({ id: "theme-spacer", width: "fill" }),
    text("toggle-label", "Dark humor", { color: t.textSecondary }),
    themeToggle("theme-toggle"),
  ]);
}

function ratingCard(model: Model, p: number, t: Theme): UINode {
  return container(
    "rating-card",
    {
      padding: 24,
      width: "fill",
      border: { width: 1, color: t.cardBorder, radius: 12 },
      background: t.cardBg,
    },
    [
      column({ spacing: 20 }, [
        text("prompt", "How would you rate Plushie?", { size: 14, color: t.textSecondary }),

        column({ id: "stars-group", spacing: 4 }, [
          starRating("stars", { rating: model.rating, themeProgress: p }),
          ...(model.errors.rating
            ? [
                text("stars-error", model.errors.rating, {
                  size: 12,
                  color: t.errorText,
                  a11y: { role: "alert", live: "polite" },
                }),
              ]
            : []),
        ]),

        rule(),
        reviewForm(model, t),
        themeRow(t),
      ]),
    ],
  );
}

function reviewCard(review: Review, i: number, p: number, t: Theme): UINode {
  return column({ id: `review-${i}`, spacing: 4, padding: 12, width: "fill" }, [
    row({ id: `rhdr-${i}`, spacing: 8, alignY: "center" }, [
      starRating(`rstars-${i}`, {
        rating: review.stars,
        readonly: true,
        scale: 0.4,
        themeProgress: p,
      }),
      text(`rname-${i}`, review.user, { size: 12, color: t.textSecondary }),
      space({ id: `rsp-${i}`, width: "fill" }),
      text(`rtime-${i}`, review.time, { size: 12, color: t.textMuted }),
    ]),
    text(`rtext-${i}`, `\u201C${review.text}\u201D`, { size: 14, color: t.text }),
  ]);
}

function reviewsList(reviews: Review[], p: number, t: Theme): UINode {
  const children: UINode[] = [];
  reviews.forEach((review, i) => {
    if (i > 0) children.push(rule({ id: `sep-${i}` }));
    children.push(reviewCard(review, i, p, t));
  });

  return column({ id: "reviews", spacing: 0, width: "fill" }, children);
}

// -- App ----------------------------------------------------------------------

export default app<Model>({
  init: {
    rating: 0,
    darkMode: false,
    reviews: INITIAL_REVIEWS,
    reviewName: "",
    reviewComment: "",
    errors: {},
  },

  update(state, event: Event) {
    // StarRating emits "select" with { value: n } (the number of stars).
    if (isWidget(event) && event.type === "select" && event.id === "stars") {
      const stars = event.data?.["value"] as number;
      const errors = { ...state.errors };
      delete errors.rating;
      return { ...state, rating: stars, errors };
    }

    // ThemeToggle emits "toggle" with { value: boolean }.
    // Animation is managed internally by the widget handler.
    if (isWidget(event) && event.type === "toggle" && event.id === "theme-toggle") {
      return { ...state, darkMode: Boolean(event.data?.["value"]) };
    }

    // Review form inputs -- clear errors on change
    if (isInput(event, "review-name")) {
      const errors = { ...state.errors };
      delete errors.name;
      return { ...state, reviewName: String(event.value), errors };
    }
    if (isInput(event, "review-comment")) {
      const errors = { ...state.errors };
      delete errors.comment;
      return { ...state, reviewComment: String(event.value), errors };
    }

    if (isClick(event, "submit-review")) return submitReview(state);
    if (isSubmit(event, "review-name")) return submitReview(state);

    return state;
  },

  view: (s) => {
    const p = s.darkMode ? 1.0 : 0.0;
    const t = buildTheme(p);

    return window("main", { title: "Rate Plushie" }, [
      container(
        "page",
        {
          padding: { top: 32, bottom: 32, left: 24, right: 24 },
          background: t.pageBg,
          width: "fill",
          height: "fill",
        },
        [
          column({ spacing: 24, width: "fill" }, [
            text("heading", "Rate Plushie", {
              size: 28,
              color: t.text,
              a11y: { role: "heading", level: 1 },
            }),
            ratingCard(s, p, t),
            text("reviews-heading", "Reviews", {
              size: 20,
              color: t.text,
              a11y: { role: "heading", level: 2 },
            }),
            reviewsList(s.reviews, p, t),
          ]),
        ],
      ),
    ]);
  },
});
