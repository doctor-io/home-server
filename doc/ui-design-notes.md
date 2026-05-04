# UI Design Notes

This document captures the current UI direction so future design passes do not lose context.

## Current Direction

Homeio is moving away from a generic "AI dashboard" look and toward a more restrained desktop-system aesthetic.

The target visual family is:

- dark, premium, minimal
- desktop-oriented, not SaaS-card-oriented
- soft blur, thin borders, controlled shadows
- compact system-like controls
- fewer decorative effects, stronger hierarchy

Working name for the current direction:

- `minimal dark system UI`
- `mac-like dock + lock/auth surfaces`

## Palette

Primary accent is now:

- `#FF6000`

Core palette in use:

- background: deep blue-black / charcoal system surfaces
- primary accent: `#FF6000`
- primary button text: `#22150F`
- text on dark surfaces: white or near-white
- muted text: low-contrast gray-white
- error: restrained red, not loud alert-box red

Important rule:

- white text on dark surfaces is correct
- dark text on the orange primary button is intentional and preferred for contrast

## Design Rules

### Surfaces

- Prefer one thin border over double borders
- Use subtle blur and compact shadows
- Avoid heavy glassmorphism
- Avoid thick framed cards unless the card is the interaction

### Controls

- Inputs should feel like system controls, not form-builder controls
- Buttons should be compact and precise
- Primary actions can use pill or soft-rounded shapes
- Icons inside inputs should be readable, white, and slightly elevated from the background

### Copy

- Use short, utility-style product copy
- Avoid generic marketing phrases
- Prefer operational labels over decorative wording

### Error States

- Error messages should not look like generic red alert boxes
- Prefer compact floating capsules or inline system-style status treatments

## Auth Screens

Files:

- [lock-screen.tsx](/Users/ahmedtabib/Code/home-server/modules/shell/components/lock-screen.tsx)
- [login-form.tsx](/Users/ahmedtabib/Code/home-server/components/auth/login-form.tsx)
- [register-form.tsx](/Users/ahmedtabib/Code/home-server/components/auth/register-form.tsx)
- [full-screen-shell.tsx](/Users/ahmedtabib/Code/home-server/modules/shell/components/full-screen-shell.tsx)

Current decisions:

- `lock`, `login`, and `register` should visually belong to the same family
- the newer preferred family is closer to the dock: lighter, more system-like, less cinematic
- top icon block should be compact and minimal
- `Home server` badge should stay subtle
- forms should use thin, system-like capsules
- auth buttons use orange fill with dark text
- error states use compact capsule-style feedback

Specific lock screen decisions:

- username is shown in Title Case
- shutdown button uses the same surface language as the rest of the screen
- date/time block should be visually separated from the main auth block

## Dock

File:

- [dock.tsx](/Users/ahmedtabib/Code/home-server/modules/shell/components/dock.tsx)

Current direction:

- minimal / Apple-like
- lower visual weight
- compact shell
- subtle running indicators
- fewer heavy shadows

Dock should feel:

- calmer than a flashy launcher
- more like an OS control surface than a dashboard widget

## Shared Shell / Overlay

The fullscreen shell now uses:

- slightly stronger dark overlay
- subtle top light
- subtle warm bottom glow tied to the orange accent

This is intentional. The wallpaper should remain atmospheric, but the UI must stay readable and dominant.

## Things To Avoid

- large generic dashboard cards
- thick double borders
- neon glow everywhere
- purple default accents
- white text on the orange primary button
- oversized decorative icons
- overly descriptive onboarding copy

## Good Next Targets

Recommended next UI passes:

1. Files window
2. Settings appearance panel
3. Terminal surface
4. Desktop windows chrome

## If We Continue Later

When continuing this design work, preserve these priorities:

1. Keep the orange accent as the default accent
2. Keep auth and lock surfaces aligned with the dock family
3. Prefer compact, system-like controls over glossy card-heavy UI
4. Keep visual restraint; add polish through spacing, hierarchy, and material, not extra decoration
