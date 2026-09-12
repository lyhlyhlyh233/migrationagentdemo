# Migration Workspace Design System

## Visual direction

A quiet, light workspace for migration delivery. The conversation is the primary surface. A compact progress rail gives orientation; an output inspector shows the active specialist's steps and results. Reference: the user's requested ChatGPT conversation structure and Codex-style output organization.

## Surfaces and color

Use neutral OKLCH tokens from `app/globals.css`: white conversation canvas; slightly gray navigation and inspector; dark neutral text and primary actions. Green is reserved for completed states and muted amber for risk. No gradients, orbit graphics, decorative glow, or color-coded agent cards.

## Typography

One native system sans-serif stack, including PingFang SC and Microsoft YaHei for Chinese. Conversation body is 14–15px with generous line height. Metadata stays subordinate; headings use modest size and weight differences. Use clear Chinese labels instead of repeated English eyebrows.

## Layout

Desktop: 236px navigation, flexible conversation, 282px inspector. Four stages occupy a horizontal progress rail instead of large cards. Chat content has a 790px maximum width and an independently scrolling body. The composer stays anchored below it. Under 981px, the inspector is opt-in; under 761px, navigation becomes a drawer.

## Components

Controls share neutral borders, 7px radii and visible keyboard focus. Embedded workflow surfaces use 10px radii and a single border. Chat input uses a 15px radius. Buttons use verb-first actions. Line icons share one stroke weight. Shortcut categories use native disclosure controls with one open menu and Escape/outside-click dismissal.

Planning inputs, MD setup, task configuration and verification live inside compact conversation embeds. Tasks, risks, deliverables and operation logs use dedicated management surfaces. Large tables scroll inside their own containers. Risk details progressively disclose secondary metadata; closure is an inline form.

## State and accessibility

Show distinct waiting, active, blocked and done steps with text and icons, not color alone. Queue and artifact statistics come from current demo state. Progress bars expose value and label. Respect reduced motion. Use live regions for assistant messages and task notifications; do not move keyboard focus when background progress updates.

## Project navigation and entry

The left header contains a native project switcher and icon actions for new project and new chat. Below it: project resources (tasks, risks, deliverables, operation log), four stage conversations, then temporary chats. Unstarted stages remain disabled placeholders; conversations become available automatically as stage gates pass. Each stage and temporary chat has its own message history. New project is a standalone form page. First entry is an empty workspace with the four-stage rail and two central entry buttons. Project state survives switching within the page session; refreshing resets this frontend demo.

Navigation uses 32–34px rows on desktop, 2px row gaps, and 12–16px group spacing. Mobile rows retain a 38px minimum height. The bottom-left area displays the current demo user avatar and account label.

## Workspace refinement

Use MigrationDirector + as the platform name. Show the stage rail only in stage conversations and the initial empty workspace. Management pages and temporary chats omit it; management pages also omit the composer and inspector. Categorized shortcuts sit immediately above the composer and open upward. Assistant messages show a branch-node icon and their recorded timestamp, without repeating the platform name. The inspector starts with current status and steps, omitting agent identity and description. Remove the daily report and DEMO badges. Embedded forms are limited to 620px with 12–16px padding.

The platform name and mark sit at the top of the left navigation, above the project switcher and creation actions. The main canvas starts directly with stage progress; its redundant branding toolbar is removed. Narrow layouts retain a small navigation launcher. When execution details are hidden, a text action in the conversation context restores them.
