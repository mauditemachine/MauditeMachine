; L'installeur Windows des plugins Maudite Machine (2026-11-25, Inno Setup 6), compile par .github/workflows/plugin-public.yml :
; iscc /DAppName=MM-RYTM /DAppKind="The drum machine" /DAppVer=... /DAppGuid=... /DSrcDir=... /DOutDir=... /DOutName=... installer.iss
; Le plugin va dans C:\Program Files\Common Files\VST3 ; la desinstallation (Applications de Windows) dans
; C:\Program Files\Maudite Machine\<plugin>, pour ne rien laisser d'autre que le .vst3 dans le dossier VST3.

[Setup]
AppId={{{#AppGuid}}
AppName={#AppName}
AppVersion={#AppVer}
AppVerName={#AppName} {#AppVer}
AppPublisher=Maudite Machine
AppPublisherURL=https://mauditemachine.com
AppSupportURL=https://mauditemachine.com/contact/
AppUpdatesURL=https://mauditemachine.com/goodies/
DefaultDirName={commonpf64}\Maudite Machine\{#AppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutDir}
OutputBaseFilename={#OutName}
SetupIconFile=mm.ico
UninstallDisplayIcon={uninstallexe}
UninstallDisplayName={#AppName} (VST3)
WizardStyle=modern
WizardImageFile=wizard-164.bmp,wizard-328.bmp
WizardSmallImageFile=small-55.bmp,small-110.bmp
LicenseFile={#SrcDir}\license.txt
Compression=lzma2/max
SolidCompression=yes
CloseApplications=no

[Files]
Source: "{#SrcDir}\{#AppName}.vst3\*"; DestDir: "{commoncf64}\VST3\{#AppName}.vst3"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
Type: filesandordirs; Name: "{commoncf64}\VST3\{#AppName}.vst3"

[UninstallDelete]
Type: filesandordirs; Name: "{commoncf64}\VST3\{#AppName}.vst3"

[Messages]
WelcomeLabel1=Install {#AppName}
WelcomeLabel2={#AppKind} from mauditemachine.com, as a VST3 plugin. Free.%n%nThis puts {#AppName}.vst3 in C:\Program Files\Common Files\VST3, the folder every VST3 host reads.%n%nMika, Maudite Machine
FinishedHeadingLabel={#AppName} is installed
FinishedLabelNoIcons=Open your DAW and rescan the plug-ins. In Ableton Live: Options > Preferences > Plug-ins, turn on "Use VST3 Plug-in System Folders", then Rescan.%n%nIt shows up under Plug-Ins > Maudite Machine > {#AppName}.%n%nQuestions or bugs: mauditemachine.com/contact
FinishedLabel=Open your DAW and rescan the plug-ins. In Ableton Live: Options > Preferences > Plug-ins, turn on "Use VST3 Plug-in System Folders", then Rescan.%n%nIt shows up under Plug-Ins > Maudite Machine > {#AppName}.%n%nQuestions or bugs: mauditemachine.com/contact

[Code]
const
  WV2 = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebView2(Root: Integer; Key: String): Boolean;
var
  V: String;
begin
  Result := RegQueryStringValue(Root, Key + WV2, 'pv', V) and (V <> '') and (V <> '0.0.0.0');
end;

{ La face du plugin s'affiche avec Microsoft Edge WebView2 (livre avec Windows 11 et Windows 10 a jour) }
function WebView2Present(): Boolean;
begin
  Result := HasWebView2(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\') or
            HasWebView2(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and (not WebView2Present()) and (not WizardSilent()) then
    MsgBox('{#AppName} shows its face with Microsoft Edge WebView2, which this PC does not seem to have.' + #13#10 + #13#10 +
           'The plugin plays without it, but its window stays empty. Get the free "WebView2 Runtime" from Microsoft: go.microsoft.com/fwlink/p/?LinkId=2124703',
           mbInformation, MB_OK);
end;
