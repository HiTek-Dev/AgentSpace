---
type: quick
task: 8
description: Create proper app icon for Tek Desktop tray
---

<objective>
Replace placeholder solid-blue square icons with a proper Tek app icon.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Generate Tek app icon at all required sizes</name>
  <files>apps/desktop/src-tauri/icons/*</files>
  <action>Generate a modern dark rounded square icon with bold white "T" letterform and blue accent dot. Create at all Tauri-required sizes: 32x32, 128x128, 128x128@2x, 512x512 PNG, .ico (multi-size), .icns (macOS).</action>
  <verify>Visual inspection of generated icons.</verify>
  <done>All icon files generated and placed in src-tauri/icons/.</done>
</task>
</tasks>
