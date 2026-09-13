# Migration Workspace Design System

## Visual direction

A quiet, light workspace for migration delivery. The conversation is the primary surface. A compact progress rail gives orientation; an output inspector shows the active specialist's steps and results. Reference: the user's requested ChatGPT conversation structure and Codex-style output organization.

## Surfaces and color

A settings button to the right of the current user opens a right-side modal drawer. Its appearance section offers white (default), neutral charcoal dark, teal (#167D7F), and burgundy (#934352), in that order. The choice applies across projects, standalone setup, conversations, management pages and diagrams; it is stored locally and restored before first paint. An absent or invalid saved value falls back to white. White uses the original quiet neutral surfaces; teal and burgundy retain restrained module tints. Dark uses separate canvas, panel and raised surface tokens, light text and adjusted semantic colors. All components use theme tokens rather than hard-coded light backgrounds.

Slate blue identifies inputs and scale statistics in colored themes; green means completion and amber means risk. Compact step segments and risk closure bars use actual project state; labels and counts provide the same information without color. No gradients, decorative glow, or agent-specific color palettes.

## Typography

The settings drawer uses a 20px title and 14px section labels. Four compact interface thumbnails preview the appearances, with labels and a check marking the current choice. The sidebar footer contains only the avatar, account name and settings icon.

One native system sans-serif stack, including PingFang SC and Microsoft YaHei for Chinese. Conversation body is 14–15px with generous line height. Metadata stays subordinate; headings use modest size and weight differences. Use clear Chinese labels instead of repeated English eyebrows.

## Layout

Desktop: 256px navigation (240px on compact desktops), flexible conversation, 282px inspector. Four stages occupy a horizontal progress rail instead of large cards. Chat content uses a responsive centered column: 790px normally, 980px from 1600px viewport width, and 1160px from 1920px. The progress rail and composer align to its inner reading width. Embedded forms remain narrower (620/700/780px) to keep conversation primary. The message body scrolls independently. The composer stays anchored below it. Under 981px, the inspector is opt-in; under 761px, navigation becomes a drawer.

## Components

Controls share neutral borders, 7px radii and visible keyboard focus. Embedded workflow surfaces use 10px radii and a single border. Chat input uses a 15px radius. Buttons use verb-first actions. Line icons share one stroke weight. Shortcut categories use native disclosure controls with one open menu and Escape/outside-click dismissal.

Planning inputs, MD setup, task configuration and verification live inside compact conversation embeds. Tasks, risks, deliverables and operation logs use dedicated management surfaces. Large tables scroll inside their own containers. Risk details progressively disclose secondary metadata; closure is an inline form.

## State and accessibility

Show distinct waiting, active, blocked and done steps with text and icons, not color alone. Queue and artifact statistics come from current demo state. Progress bars expose value and label. Use a slow sweep only while a stage is executing, breathing nodes only for actual running work, brief check drawing for completed steps, and a 160ms menu entrance. Waiting for user input is static. Respect reduced motion. Use live regions for assistant messages and task notifications; do not move keyboard focus when background progress updates.

## Project navigation and entry

The left header contains a native project switcher and icon actions for new project and new chat. The sidebar order is project resources, a unified delivery conversation list, then temporary chats. Before project creation, resource entries retain normal text contrast but remain disabled; their hover titles explain that a project must be created first. Delivery history remains visible across stages. Automatically created conversations are named after their stage; other conversation names show a short stage label inline at the right. Full names and stage context remain available in hover titles and accessible labels; omit repeated creation subtitles. Both support inline renaming. The plus action creates a conversation in the currently viewed stage.

The top progress rail switches between entered stages and restores their last viewed conversation. A ready but unentered stage is labeled “待确认”. An inline handoff notice progressively discloses completed prerequisites and the effect of proceeding. Only explicit confirmation creates the next stage conversation; cancellation preserves all state. Background completion announces readiness without navigation or conversation creation.

Stage entry conversations retain guided forms. Other conversations start with short project context and reveal shared operations through shortcuts. Messages, drafts, pending replies and expanded panels belong to a conversation, while execution and project records are shared. Results return to the initiating conversation. Management and temporary chats hide the rail but retain delivery history. New project remains a standalone form followed by the research conversation. The empty lobby omits the conversation context toolbar and opens directly onto its welcome actions. The empty lobby and new projects awaiting assessment show a compact four-stage preview with icons and short stage descriptions, without percentages or empty progress bars. The assessment stage becomes available after project creation; once assessment starts, the preview becomes the live progress rail. Descriptions hide on compact screens while stage titles remain visible. Project state resets on refresh.

Resource, delivery and temporary navigation share 14px text, 16px leading icons, 36px desktop rows and 2px row gaps. Section labels use the same 14px size as resource menu entries; 20px spacing separates groups without divider lines. Align icon and text columns across lists. Long conversation names truncate on one line while stage labels remain visible. The mobile drawer is 288px wide at most, with 44px navigation rows and icon targets. The bottom-left area displays the current user avatar and account label.

## Workspace refinement

Use MigrationDirector Plus as the platform name. Show the stage rail only in stage conversations and the initial empty workspace. Management pages and temporary chats omit it; management pages also omit the composer and inspector. Categorized shortcuts sit immediately above the composer and open upward. Assistant messages show a branch-node icon and their recorded timestamp, without repeating the platform name. The inspector starts with current status and steps, omitting agent identity and description. Remove the daily report and DEMO badges. Embedded forms are limited to 620px with 12–16px padding.

The platform name and mark sit at the top of the left navigation, above the project switcher and creation actions. A desktop toggle collapses navigation into a 56px rail with expand, new project, new chat and settings actions. The conversation takes the freed width; inspector visibility is independent. Collapse state is shared across projects during the page session. Narrow screens retain their drawer, regardless of desktop collapse state. Toggling moves keyboard focus to the corresponding expand/collapse button and preserves conversation state. The main canvas starts directly with stage progress; its redundant branding toolbar is removed. Narrow layouts retain a small navigation launcher. When execution details are hidden, a text action in the conversation context restores them.

## Header logo

The upper-left navigation and project setup header use the Huawei flower symbol before MigrationDirector Plus. The browser favicon uses the same symbol, centered in a square viewport. Preserve its official red and proportions across all themes. The local `public/huawei-symbol.svg` contains the symbol path from the [Huawei website logo](https://consumer.huawei.com/.resources/huawei-cbg-site-lm-basic/webresources/mkt/etc/designs/huawei-cbg-site/clientlib-campaign-v4/common-v4/images/logo.svg).


## Settings drawer and localization

The native modal dialog slides in from the right, 440px wide on desktop and bounded by the viewport on mobile. It traps keyboard focus, closes with Escape or a backdrop click, and restores focus to its trigger. Its scrollable body contains appearance, background and language sections; a fixed footer explains local saving. Reduced-motion users receive no slide animation.

Background choices use bundled images referenced in the background-selection conversation: white curves, misty mountains and graphite waves, plus the default solid canvas. They apply to the lobby, conversation workspace and project setup. Sidebars, input surfaces and management tables remain legible and opaque. Photo opacity is controlled by theme and image; no external image host is needed at runtime. Credits live in `public/backgrounds/README.md`.

Simplified Chinese and English share the same layout and state. A local string catalog translates rendered labels, controls, statuses, shortcuts and system-authored templates. Select values and business enums retain their canonical values. Assistant replies use the language active when issued; existing messages, user questions, project names and renamed conversations retain their original content. Changing language does not remount projects or discard drafts. The HTML language attribute and saved preferences update immediately.
