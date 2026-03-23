# Layout

Plushie's layout model mirrors iced's. Understanding it is essential
for building UIs that size and position correctly.

## Length

Length controls how a widget claims space along an axis.

| TypeScript value | Meaning |
|---|---|
| `'fill'` | Take all remaining space |
| `{ fillPortion: n }` | Proportional share of remaining space |
| `'shrink'` | Use minimum/intrinsic size |
| `200` | Exact pixel size |

```tsx
// Fill available width
<Column width="fill">...</Column>

// Fixed width
<Container id="sidebar" width={250}>...</Container>

// Proportional: left takes 2/3, right takes 1/3
<Row>
  <Container id="left" width={{ fillPortion: 2 }}>...</Container>
  <Container id="right" width={{ fillPortion: 1 }}>...</Container>
</Row>

// Shrink to content
<Button id="save" width="shrink">Save</Button>
```

### Default lengths

Most widgets default to `'shrink'` for both width and height. Layout
containers (`Column`, `Row`) typically shrink but grow to accommodate
their children.

## Padding

Padding is the space between a widget's boundary and its content.

| TypeScript value | Meaning |
|---|---|
| `16` | Uniform: 16px on all sides |
| `[10, 20]` | Axis: 10px vertical, 20px horizontal |
| `[5, 10, 5, 10]` | Per-side: top, right, bottom, left |
| `{ top: 5, right: 10, bottom: 5, left: 10 }` | Named per-side |

```tsx
<Container id="box" padding={16}>...</Container>
<Container id="box" padding={[8, 16]}>...</Container>
<Container id="box" padding={{ top: 0, right: 16, bottom: 8, left: 16 }}>
  ...
</Container>
```

Padding is accepted by `Container`, `Column`, `Row`, `Scrollable`,
`Button`, `TextInput`, and `TextEditor`.

## Spacing

Spacing is the gap between children in a layout container.

```tsx
<Column spacing={8}>
  <Text>First</Text>
  <Text>Second</Text>   {/* 8px gap between First and Second */}
  <Text>Third</Text>    {/* 8px gap between Second and Third */}
</Column>
```

Spacing is accepted by `Column`, `Row`, and `Scrollable`.

## Alignment

Alignment controls how children are positioned within their parent
along the cross axis.

### alignX (horizontal alignment in a Column)

| Value | Meaning |
|---|---|
| `'start'` or `'left'` | Left-aligned |
| `'center'` | Centered |
| `'end'` or `'right'` | Right-aligned |

### alignY (vertical alignment in a Row)

| Value | Meaning |
|---|---|
| `'start'` or `'top'` | Top-aligned |
| `'center'` | Centered |
| `'end'` or `'bottom'` | Bottom-aligned |

```tsx
// Center children horizontally in a column
<Column alignX="center">
  <Text>Centered</Text>
  <Button id="ok">OK</Button>
</Column>

// Center a single child in a container
<Container id="page" width="fill" height="fill" center>
  <Text>Dead center</Text>
</Container>
```

The `center` prop on `Container` sets both `alignX: 'center'` and
`alignY: 'center'`.

## Layout containers

### Column

Arranges children vertically (top to bottom).

```tsx
<Column id="main" spacing={16} padding={20} width="fill" alignX="center">
  <Text id="title" size={24}>Title</Text>
  <Text id="subtitle" size={14}>Subtitle</Text>
</Column>
```

Props: `spacing`, `padding`, `width`, `height`, `maxWidth`, `alignX`,
`clip`, `wrap`.

### Row

Arranges children horizontally (left to right).

```tsx
<Row spacing={8} alignY="center">
  <Button id="back">&lt;</Button>
  <Text>Page 1 of 5</Text>
  <Button id="next">&gt;</Button>
</Row>
```

Props: `spacing`, `padding`, `width`, `height`, `maxWidth`, `alignY`,
`clip`, `wrap`.

### Container

Wraps a single child with padding, alignment, and styling.

```tsx
<Container id="card" padding={16} style="rounded_box" width="fill">
  <Column>
    <Text>Card title</Text>
    <Text>Card content</Text>
  </Column>
</Container>
```

Props: `padding`, `width`, `height`, `maxWidth`, `maxHeight`,
`alignX`, `alignY`, `center`, `clip`, `style`, `background`,
`border`, `shadow`.

### Scrollable

Wraps content in a scrollable region.

```tsx
<Scrollable id="list" height={400} width="fill">
  <Column spacing={4}>
    {items.map(item => <Text key={item.id}>{item.name}</Text>)}
  </Column>
</Scrollable>
```

Props: `width`, `height`, `direction` (`'vertical'`, `'horizontal'`),
`spacing`, `anchor`, `scrollbarWidth`, `scrollerWidth`.

### Stack

Overlays children on top of each other (z-stacking). Later children
are on top.

```tsx
<Stack>
  <Image id="bg" source="background.png" width="fill" height="fill" />
  <Container id="overlay" width="fill" height="fill" center>
    <Text id="title" size={48}>Overlaid text</Text>
  </Container>
</Stack>
```

### Space

Empty spacer. Takes up space without rendering anything.

```tsx
<Row>
  <Text>Left</Text>
  <Space width="fill" />  {/* pushes Right to the far right */}
  <Text>Right</Text>
</Row>
```

### Grid

Arranges children in a grid layout.

```tsx
<Grid id="gallery" columns={3} spacing={8}>
  {items.map(item =>
    <Image id={`img-${item.id}`} source={item.url} width="fill" />
  )}
</Grid>
```

## Common layout patterns

### Centered page

```tsx
<Container id="page" width="fill" height="fill" center>
  <Column spacing={16} alignX="center">
    <Text id="welcome" size={32}>Welcome</Text>
    <Button id="start">Get Started</Button>
  </Column>
</Container>
```

### Sidebar + content

```tsx
<Row width="fill" height="fill">
  <Container id="sidebar" width={250} height="fill" padding={16}>
    {navItems(state)}
  </Container>
  <Container id="content" width="fill" height="fill" padding={16}>
    {mainContent(state)}
  </Container>
</Row>
```

### Header + body + footer

```tsx
<Column width="fill" height="fill">
  <Container id="header" width="fill" padding={[8, 16]}>
    {header(state)}
  </Container>
  <Scrollable id="body" width="fill" height="fill">
    {bodyContent(state)}
  </Scrollable>
  <Container id="footer" width="fill" padding={[8, 16]}>
    {footer(state)}
  </Container>
</Column>
```
