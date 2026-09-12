# Migration Workspace Design System

## Visual direction

A quiet, light workspace for migration delivery. The conversation is the primary surface. A compact progress rail gives orientation; an output inspector shows the active specialist's steps and results. Reference: the user's requested ChatGPT conversation structure and Codex-style output organization.

## Surfaces and color

Use restrained graphite and burgundy with semantic OKLCH tokens from `app/globals.css`. Brand/action burgundy is #934352; selected surfaces use #F7EDF0 with darker burgundy text. The canvas stays white; navigation and the inspector have a slight brand tint. Accent color marks brand identity, primary actions, selection and running work. Slate blue identifies inputs and scale statistics; green means completion and amber means risk. Compact step segments and risk closure bars use actual project state; labels and counts provide the same information without color. No gradients, decorative glow, or agent-specific color palettes.

## Typography

One native system sans-serif stack, including PingFang SC and Microsoft YaHei for Chinese. Conversation body is 14–15px with generous line height. Metadata stays subordinate; headings use modest size and weight differences. Use clear Chinese labels instead of repeated English eyebrows.

## Layout

Desktop: 236px navigation, flexible conversation, 282px inspector. Four stages occupy a horizontal progress rail instead of large cards. Chat content uses a responsive centered column: 790px normally, 980px from 1600px viewport width, and 1160px from 1920px. The progress rail and composer align to its inner reading width. Embedded forms remain narrower (620/700/780px) to keep conversation primary. The message body scrolls independently. The composer stays anchored below it. Under 981px, the inspector is opt-in; under 761px, navigation becomes a drawer.

## Components

Controls share neutral borders, 7px radii and visible keyboard focus. Embedded workflow surfaces use 10px radii and a single border. Chat input uses a 15px radius. Buttons use verb-first actions. Line icons share one stroke weight. Shortcut categories use native disclosure controls with one open menu and Escape/outside-click dismissal.

Planning inputs, MD setup, task configuration and verification live inside compact conversation embeds. Tasks, risks, deliverables and operation logs use dedicated management surfaces. Large tables scroll inside their own containers. Risk details progressively disclose secondary metadata; closure is an inline form.

## State and accessibility

Show distinct waiting, active, blocked and done steps with text and icons, not color alone. Queue and artifact statistics come from current demo state. Progress bars expose value and label. Use a slow sweep only while a stage is executing, breathing nodes only for actual running work, brief check drawing for completed steps, and a 160ms menu entrance. Waiting for user input is static. Respect reduced motion. Use live regions for assistant messages and task notifications; do not move keyboard focus when background progress updates.

## Project navigation and entry

The left header contains a native project switcher and icon actions for new project and new chat. Below it: four stage conversations, project resources (tasks, risks, deliverables, operation log), then temporary chats. The first stage group has no leading divider; following groups use a thin separator and compact spacing. Unstarted stages remain disabled placeholders; conversations become available automatically as stage gates pass. Each stage and temporary chat has its own message history. New project is a standalone form page. First entry is an empty workspace with the four-stage rail and two central entry buttons. Project state survives switching within the page session; refreshing resets this frontend demo.

Navigation uses 32–34px rows on desktop, 2px row gaps, and 12–16px group spacing. Mobile rows retain a 38px minimum height. The bottom-left area displays the current demo user avatar and account label.

## Workspace refinement

Use MigrationDirector + as the platform name. Show the stage rail only in stage conversations and the initial empty workspace. Management pages and temporary chats omit it; management pages also omit the composer and inspector. Categorized shortcuts sit immediately above the composer and open upward. Assistant messages show a branch-node icon and their recorded timestamp, without repeating the platform name. The inspector starts with current status and steps, omitting agent identity and description. Remove the daily report and DEMO badges. Embedded forms are limited to 620px with 12–16px padding.

The platform name and mark sit at the top of the left navigation, above the project switcher and creation actions. The main canvas starts directly with stage progress; its redundant branding toolbar is removed. Narrow layouts retain a small navigation launcher. When execution details are hidden, a text action in the conversation context restores them.
