@NAME@, free VST3 plugin by Maudite Machine
https://mauditemachine.com

This zip holds every version. Pick the folder for your computer:
  macOS/    Mac, macOS 11 or later, Apple Silicon and Intel
[[WIN]]  Windows/  PC, Windows 10 or 11, 64-bit (beta)
[[/WIN]][[NOWIN]]  (Windows version coming soon)
[[/NOWIN]]
Any VST3 host works: Ableton Live, Bitwig, Reaper, Cubase, FL Studio.
Logic Pro needs Audio Units, not available yet.

INSTALL ON macOS
1. Open the macOS folder. Move @NAME@.vst3 to ~/Library/Audio/Plug-Ins/VST3/
   (Finder: Go > Go to Folder, paste the path; create the VST3 folder if it is missing).
2. The plugin is not notarized by Apple yet, so macOS blocks it the first time.
   Open Terminal (Applications > Utilities), paste this line and press Return:

   xattr -cr ~/Library/Audio/Plug-Ins/VST3/@NAME@.vst3 && codesign --force --deep --sign - ~/Library/Audio/Plug-Ins/VST3/@NAME@.vst3

3. Restart your DAW and rescan the plug-ins.
   Ableton Live: Settings > Plug-Ins, turn on "Use VST3 Plug-in System Folders", then Option-click Rescan.
4. Find it under Plug-Ins > Maudite Machine > @NAME@.
[[WIN]]
INSTALL ON WINDOWS (beta)
1. Open the Windows folder. Copy the whole @NAME@.vst3 folder to C:\Program Files\Common Files\VST3\
   (Windows asks for administrator permission).
2. Restart your DAW and rescan the plug-ins.
   Ableton Live: Options > Preferences > Plug-ins, turn on "Use VST3 Plug-in System Folders", then Rescan.
3. Find it under Plug-Ins > Maudite Machine > @NAME@.
4. The plugin window uses Microsoft Edge WebView2, already part of Windows 11 and up-to-date Windows 10.
   If the window shows a message instead of the machine, install the "WebView2 Runtime" from Microsoft's site.
The Windows version is new: if something goes wrong, tell me at https://mauditemachine.com/contact/
[[/WIN]]
TERMS
Free to use in your music, commercial releases included.
Please do not sell or re-host the plugin: share https://mauditemachine.com/goodies/ instead.
Provided as is, without warranty.

The plugins are free and stay free. If they end up in your tracks, you can buy me a coffee:
https://ko-fi.com/mauditemachine
Questions or bugs: https://mauditemachine.com/contact/

---

INSTALLATION (FR)
Mac : dossier macOS, deplace @NAME@.vst3 dans ~/Library/Audio/Plug-Ins/VST3/, colle la ligne du Terminal ci-dessus, refais un scan (Ableton : Option + clic sur Rescan).
[[WIN]]Windows : dossier Windows, copie le dossier @NAME@.vst3 dans C:\Program Files\Common Files\VST3\, refais un scan des plugins.
[[/WIN]]
