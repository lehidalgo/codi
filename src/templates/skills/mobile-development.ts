export const template = `---
name: {{name}}
description: Mobile development patterns and guidelines. Covers iOS (SwiftUI/UIKit), Android (Compose/XML), and cross-platform (KMP, React Native, Flutter) with architecture, testing, and platform-specific best practices.
compatibility: [claude-code, cursor, codex]
managed_by: codi
---

# {{name}}

## When to Use

Use when building mobile applications, reviewing mobile code, or making architectural decisions for iOS, Android, or cross-platform projects.

## When to Activate

- User is building or modifying an iOS, Android, or cross-platform mobile app
- User asks about mobile architecture patterns like MVVM, dependency injection, or data layers
- User needs guidance on SwiftUI, UIKit, Jetpack Compose, or React Native code
- User wants to review mobile code for platform-specific best practices
- User asks about mobile testing strategies, accessibility, or app store guidelines

## Platform Guidelines

### iOS Development

**[CODING AGENT]** Follow these patterns for iOS:

**SwiftUI (preferred for new UI):**
- Use \\\`@Observable\\\` macro (iOS 17+) for state management — replaces \\\`ObservableObject\\\`/\\\`@Published\\\` with simpler, more granular tracking
- Use \\\`@State\\\` for view-local state, \\\`@Binding\\\` for child-to-parent, \\\`@Environment\\\` for shared dependencies
- Create SwiftUI previews for every view using \\\`#Preview\\\` macro
- Use \\\`@MainActor\\\` for UI-bound state
- Prefer \\\`.task { }\\\` modifier for async loading over \\\`onAppear\\\`
- Use \\\`NavigationStack\\\` (not deprecated \\\`NavigationView\\\`)
- Use SwiftData with \\\`@Model\\\` for persistence (iOS 17+) — simpler than Core Data

**UIKit (use when SwiftUI is insufficient):**
- Programmatic layout with Auto Layout (avoid storyboards in teams)
- Use \\\`UICollectionView\\\` with compositional layout for complex lists
- Bridge to SwiftUI using \\\`UIHostingController\\\`

**Testing:**
- XCTest for unit and integration tests
- Swift Testing (\\\`@Test\\\`, \\\`#expect\\\`) for new test code
- XCUITest for UI automation of critical flows

### Android Development

**[CODING AGENT]** Follow these patterns for Android:

**Jetpack Compose (preferred for new UI):**
- Material 3 design components
- \\\`LazyColumn\\\`/\\\`LazyRow\\\` for lists (not \\\`Column\\\` with \\\`forEach\\\`)
- Use \\\`remember\\\` and \\\`derivedStateOf\\\` to minimize recompositions
- \\\`collectAsStateWithLifecycle\\\` for Flow observation (StateFlow/SharedFlow)
- Use Compose Navigation for screen transitions
- Use Hilt for DI with \\\`@HiltViewModel\\\` — integrates with Compose lifecycle

**XML Layouts (legacy maintenance only):**
- Use ViewBinding (not findViewById or synthetic)
- ConstraintLayout for complex screens
- Migrate incrementally to Compose using \\\`ComposeView\\\`

**Testing:**
- JUnit 5 for unit tests
- Espresso for UI tests
- Robolectric for tests needing Android framework without a device

### Cross-Platform Development

**[CODING AGENT]** Choose the right approach:

**Kotlin Multiplatform (KMP):**
- Share business logic, networking, and data layers
- Keep UI native (SwiftUI + Compose)
- Use \\\`expect\\\`/\\\`actual\\\` for platform-specific implementations
- SQLDelight for shared database, Ktor for shared networking

**React Native / Flutter:**
- Use for shared UI when native feel is acceptable
- Keep platform-specific code in separate modules
- Test on both platforms regularly, not just one

## Architecture Patterns

**[CODING AGENT]** Apply these patterns across all platforms:

**MVVM Architecture:**
- View: UI rendering only, no business logic
- ViewModel: UI state management, user action handling
- Model: Domain entities, business rules
- Repository: Data access abstraction (network + local cache)

**Data Layer:**
- Repository pattern: single source of truth
- Offline-first: cache locally, sync when connected
- Use sealed classes/enums for state: Loading, Success, Error

**Dependency Injection:**
- iOS: Swift Package-based DI or manual injection via init
- Android: Hilt/Dagger or manual injection
- Avoid service locator pattern (hidden dependencies)

## Testing Strategy

**[CODING AGENT]** Test at three levels:

1. **Unit tests**: ViewModels, repositories, business logic (80%+ coverage)
2. **UI tests**: Critical user flows (login, checkout, data entry)
3. **Snapshot tests**: Layout regression for key screens

## Platform Considerations

**[CODING AGENT]** Check for:
- Responsive layouts: support multiple screen sizes and orientations
- Accessibility: VoiceOver (iOS), TalkBack (Android), sufficient contrast
- App store guidelines: review Apple HIG and Material Design guidelines
- Performance: 60fps scrolling, fast app launch (<2s cold start)
- Battery: minimize background work, use efficient networking
- Permissions: request only when needed, explain why to the user
`;
