---
name: JobLens Design System
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadd'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeedf0'
  surface-container-high: '#e8e8eb'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f0f0f3'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#5d5e66'
  on-secondary: '#ffffff'
  secondary-container: '#e3e1ec'
  on-secondary-container: '#63646c'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1c'
  on-tertiary-container: '#838484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e3e1ec'
  secondary-fixed-dim: '#c6c5cf'
  on-secondary-fixed: '#1a1b22'
  on-secondary-fixed-variant: '#46464e'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display:
    fontFamily: Inter, PingFang SC
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter, PingFang SC
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter, PingFang SC
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter, PingFang SC
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter, PingFang SC
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter, PingFang SC
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter, PingFang SC
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-max: 1200px
  gutter: 24px
  margin-desktop: 48px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is rooted in high-performance utility and functional minimalism, specifically tailored for an AI-driven resume optimization environment. It prioritizes clarity and focus, stripping away ornamental distractions to treat user data as the primary visual element.

The aesthetic draws inspiration from modern developer tools and high-end productivity platforms. It utilizes a strict grayscale palette, hairline borders, and generous whitespace to create a "workbench" feel that is sophisticated, reliable, and precise. The emotional response should be one of professional confidence and systematic efficiency.

## Colors

The color strategy is almost entirely monochromatic to ensure that user-generated content and AI-driven insights remain the focal point. 

- **Primary Surface**: Pure white (#FFFFFF) is used for all main canvases to maximize contrast.
- **Action & Text**: Rich Black (#0A0A0A) is used for primary actions, headings, and high-emphasis text.
- **Muted Elements**: Mid-tones (#71717A) are reserved for secondary metadata and placeholder text.
- **Structural Lines**: Hairline borders (#E4E4E7) define the architecture without adding visual weight.
- **Subtle Planes**: Off-white (#FAFAFA) provides soft contrast for background surfaces, toolbars, and inactive states.
- **Semantic Accents**: Success, Warning, and Destructive colors are used sparingly and only to communicate functional status or critical system feedback.

## Typography

Typography is the primary vehicle for hierarchy. The system uses a dual-font stack: **Inter** for Latin characters and **PingFang SC** for Simplified Chinese, ensuring a clean, modern, and highly legible experience across all technical and editorial content.

- **Weight Usage**: Use SemiBold (600) for primary headings and Medium (500) for UI labels or button text. Regular (400) is standard for all body copy.
- **Tight Tracking**: Larger headings use slight negative letter-spacing to maintain a compact, "engineered" look.
- **Vertical Rhythm**: Line heights are strictly adhered to, ensuring that multi-line Chinese text remains readable and balanced.
- **Scale**: The type scale is conservative, favoring clarity over dramatic size shifts.

## Layout & Spacing

This design system utilizes a fixed-grid philosophy for desktop and a fluid-stack model for mobile devices.

- **Desktop**: The content is centered within a maximum width of 1200px. A 12-column grid is used for complex dashboard layouts, while simple forms or document views use a narrower 8-column center-aligned track.
- **Breakpoints**: 
    - **Mobile (< 768px)**: Layouts reflow into a single column. Sidebars transition to hidden drawers or bottom sheets. Margins reduce to 16px.
    - **Tablet (768px - 1024px)**: 2-column structures are permitted; gutters remain at 24px.
- **Spacing Rhythm**: All measurements are multiples of a 4px base unit. Generous whitespace between major sections (32px+) is encouraged to prevent the UI from feeling cluttered during intensive data entry or AI analysis.

## Elevation & Depth

To maintain the ultra-minimalist aesthetic, the design system explicitly forbids the use of drop shadows. Depth is achieved entirely through technical layering:

1.  **Hairline Borders**: 1px solid borders (#E4E4E7) are the primary method of separating components and sections.
2.  **Tonal Backgrounds**: Secondary areas (like sidebars or toolbars) use a subtle background fill (#FAFAFA) to distinguish themselves from the primary white canvas.
3.  **Layered Surfaces**: In the event of overlays (modals or popovers), a 1px border is combined with a pure white background. Contrast is maintained by the absence of content behind the modal or by using a semi-transparent white backdrop.

## Shapes

The shape language is controlled and systematic. A base radius of 8px (0.5rem) is applied to most UI components to soften the professional aesthetic without making it appear "playful."

- **Input & Buttons**: Use the standard 8px radius.
- **Cards & Sections**: Use 8px to maintain consistency.
- **Tags & Indicators**: Small components may use a 4px radius for a sharper, more precise appearance.
- **Iconography**: Icons should follow a 1.5px stroke weight with consistent square caps and joins to match the hairline border aesthetic.

## Components

- **Buttons**:
    - **Primary**: Solid #0A0A0A background with white text. No shadow.
    - **Secondary**: Pure white background with 1px #E4E4E7 border and #0A0A0A text.
    - **Ghost**: No background or border; #71717A text that shifts to #0A0A0A on hover.
- **Input Fields**: 1px #E4E4E7 border, 8px radius, white background. Focus state: 1px #0A0A0A border.
- **Chips / Tags**: Background #FAFAFA, border 1px #E4E4E7, 12px label-md typography.
- **Cards**: Pure white background, 1px #E4E4E7 border, 8px radius. No internal shadows.
- **Lists**: Rows separated by 1px #E4E4E7 bottom borders. Use 16px vertical padding for high readability.
- **Checkboxes & Radios**: 1.5px border weight, #0A0A0A fill when selected. Geometric and sharp.
- **AI Workbench Specifics**:
    - **Comparison View**: Split screen with a 1px vertical divider.
    - **Suggestion Callouts**: Use #FAFAFA background with a left-accent border (2px) in #0A0A0A to highlight AI-generated recommendations.