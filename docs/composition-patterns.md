# Composition patterns

Plushie provides primitives, not pre-built composites. There is no
`TabBar` widget, no `Modal` widget, no `Card` widget. Instead, you
compose the same building blocks (`Row`, `Column`, `Container`,
`Stack`, `Button`, `Text`, `Rule`, `MouseArea`, `Space`) with
`StyleMap` to build any UI pattern you need.

This guide shows how. Every pattern is copy-pasteable.

---

## 1. Tab bar

A horizontal row of buttons where the active tab is visually distinct.

```tsx
function tabBar(activeTab: string, tabs: string[]) {
  return (
    <Row spacing={0}>
      {tabs.map(tab => (
        <Button
          id={`tab-${tab}`}
          style={tab === activeTab ? {
            base: 'primary',
            border: { width: 0, radius: { topLeft: 8, topRight: 8, bottomLeft: 0, bottomRight: 0 } },
          } : {
            background: 'transparent',
          }}
          onClick={(s: any) => ({ ...s, activeTab: tab })}
        >
          {tab}
        </Button>
      ))}
    </Row>
  )
}
```

### How it works

- Active tab uses the `primary` style preset with custom border
  radius (rounded top, flat bottom)
- Inactive tabs use transparent background
- Click handler updates `activeTab` in the model

---

## 2. Card

A bordered container with padding and optional shadow.

```tsx
function card(id: string, children: UINode[]) {
  return (
    <Container id={id} padding={16}
      border={{ width: 1, color: '#e0e0e0', radius: 8 }}
      shadow={{ offsetY: 2, blurRadius: 4, color: '#00000010' }}>
      <Column spacing={8}>{children}</Column>
    </Container>
  )
}
```

---

## 3. Sidebar + content

```tsx
<Row width="fill" height="fill">
  <Container id="sidebar" width={250} height="fill" padding={16}
    background="#f5f5f5" border={{ width: 1, color: '#e0e0e0' }}>
    {navItems(state)}
  </Container>
  <Container id="content" width="fill" height="fill" padding={24}>
    {mainContent(state)}
  </Container>
</Row>
```

---

## 4. Modal

Use `Stack` to overlay a modal on top of the main content:

```tsx
<Stack width="fill" height="fill">
  {mainContent(state)}
  {state.modalOpen && (
    <Container id="overlay" width="fill" height="fill"
      background="#00000080" center>
      <Container id="modal" padding={24} width={400}
        background="#ffffff" border={{ radius: 12 }}
        shadow={{ offsetY: 4, blurRadius: 16, color: '#00000030' }}>
        <Column spacing={16}>
          <Text id="modalTitle" size={18}>Confirm</Text>
          <Text>Are you sure?</Text>
          <Row spacing={8}>
            <Button id="confirmYes" style="primary"
              onClick={(s: any) => ({ ...s, modalOpen: false, confirmed: true })}>
              Yes
            </Button>
            <Button id="confirmNo"
              onClick={(s: any) => ({ ...s, modalOpen: false })}>
              No
            </Button>
          </Row>
        </Column>
      </Container>
    </Container>
  )}
</Stack>
```

---

## 5. Collapsible section

```tsx
function collapsible(id: string, title: string, collapsed: boolean, children: UINode[]) {
  return (
    <Column id={id} spacing={0}>
      <Button id={`${id}-toggle`}
        onClick={(s: any) => ({ ...s, [`${id}Collapsed`]: !collapsed })}>
        {collapsed ? '+ ' : '- '}{title}
      </Button>
      {!collapsed && (
        <Container id={`${id}-content`} padding={[0, 0, 0, 16]}>
          <Column spacing={4}>{children}</Column>
        </Container>
      )}
    </Column>
  )
}
```

---

## 6. Toolbar

```tsx
<Row id="toolbar" spacing={4} padding={[4, 8]} alignY="center"
  style={{ background: '#f0f0f0', border: { width: 0, radius: 0 } }}>
  <Button id="new" style="text">New</Button>
  <Button id="open" style="text">Open</Button>
  <Button id="save" style="text">Save</Button>
  <Rule direction="vertical" height={20} />
  <Button id="undo" style="text">Undo</Button>
  <Button id="redo" style="text">Redo</Button>
  <Space width="fill" />
  <Text size={12} color="#888">Saved</Text>
</Row>
```

---

## 7. View helpers

Extract reusable view functions. They're just functions that return
`UINode`:

```typescript
function statusBadge(status: 'active' | 'inactive' | 'error'): UINode {
  const colors = {
    active: '#22c55e',
    inactive: '#94a3b8',
    error: '#ef4444',
  }
  return Container({
    padding: [2, 8],
    background: colors[status],
    border: { radius: 4 },
    children: [Text({ children: status, size: 12, color: '#ffffff' })],
  })
}
```

## Tips

- **Don't wrap primitives.** Write helper functions, not wrapper
  components. Functions are simpler and more flexible.
- **StyleMap presets** save repetition. Define a preset once, reuse
  it across widgets via the `base` field.
- **Space widget** is your flex spacer. Put `<Space width="fill" />`
  between items to push them apart.
- **Container background + padding** gives you boxes. No need for
  a separate "Panel" or "Card" widget.
