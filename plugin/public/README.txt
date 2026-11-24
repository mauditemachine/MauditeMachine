@NAME@, VST3 for macOS (Apple Silicon and Intel)
by Maudite Machine - https://mauditemachine.com

INSTALL
1. Move @NAME@.vst3 to ~/Library/Audio/Plug-Ins/VST3/
   (Finder: Go > Go to Folder, paste the path; create the VST3 folder if it is missing).
2. The plugin is not notarized by Apple yet, so macOS blocks it the first time.
   Open Terminal (Applications > Utilities), paste this line and press Return:

   xattr -cr ~/Library/Audio/Plug-Ins/VST3/@NAME@.vst3 && codesign --force --deep --sign - ~/Library/Audio/Plug-Ins/VST3/@NAME@.vst3

3. Restart your DAW and rescan the plug-ins.
   Ableton Live: Settings > Plug-Ins, turn on "Use VST3 Plug-in System Folders", then Option-click Rescan.
4. Find it under Plug-Ins > Maudite Machine > @NAME@.

REQUIREMENTS
macOS 11 or later. Any VST3 host: Ableton Live, Bitwig, Reaper, Cubase, FL Studio.
Logic Pro needs Audio Units, not available yet. No Windows version yet.

TERMS
Free to use in your music, commercial releases included.
Please do not sell or re-host the plugin: share https://mauditemachine.com/goodies/ instead.
Provided as is, without warranty.

The plugins are free and stay free. If they end up in your tracks, donations are welcome
(link on the download page). Questions or bugs: https://mauditemachine.com/contact/

---

INSTALLATION (FR)
1. Deplace @NAME@.vst3 dans ~/Library/Audio/Plug-Ins/VST3/
2. Le plugin n'est pas encore notarise par Apple : dans le Terminal, colle la ligne de l'etape 2 ci-dessus.
3. Relance ton logiciel et refais un scan des plugins (Ableton : Option + clic sur Rescan).
