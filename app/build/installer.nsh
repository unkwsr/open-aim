!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  !macro customPageAfterChangeDir
    ; electron-builder's directory-page hook adds the app subfolder. Silent
    ; updates already received an exact, validated /D path from the running app.
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
    !define MUI_PAGE_CUSTOMFUNCTION_PRE AimInstFilesPre
    Function AimInstFilesPre
      ${IfNot} ${Silent}
        Call instFilesPre
      ${EndIf}
    FunctionEnd
  !macroend
!endif

; Replaces the uninstall welcome page, before any files are removed.
; Silent upgrades never visit this page and always keep the profile.
!ifdef BUILD_UNINSTALLER
  Var aimRemoveData
  Var aimKeepRadio
  Var aimDeleteRadio

  !macro customUnWelcomePage
    UninstPage custom un.AimDataPage un.AimDataPageLeave

  Function un.AimDataPage
    ${If} ${isUpdated}
      Abort
    ${EndIf}
    ${If} ${Silent}
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "Uninstall AimTrainer" "Choose what to do with your saved settings."
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 35u "AimTrainer will be removed from this computer. You can keep your settings for the next time you install it, or remove your local data too."
    Pop $0
    ${NSD_CreateRadioButton} 0 48u 100% 18u "Keep my settings and training data (recommended)"
    Pop $aimKeepRadio
    ${NSD_CreateRadioButton} 0 75u 100% 18u "Delete my settings and all local AimTrainer data"
    Pop $aimDeleteRadio
    ${If} $aimRemoveData == ${BST_CHECKED}
      ${NSD_Check} $aimDeleteRadio
    ${Else}
      ${NSD_Check} $aimKeepRadio
    ${EndIf}
    ${NSD_CreateLabel} 12u 101u 95% 36u "Deleting includes saved settings, scores, custom drills and local backups. Exported backups and your VALORANT files are not affected."
    Pop $0
    nsDialogs::Show
  FunctionEnd

  Function un.AimDataPageLeave
    ${NSD_GetState} $aimDeleteRadio $aimRemoveData
  FunctionEnd
  !macroend

  !macro customUnInstall
    ${IfNot} ${isUpdated}
    ${AndIfNot} ${Silent}
    ${AndIf} $aimRemoveData == ${BST_CHECKED}
      ; Electron profiles belong to the current user, even for all-users installs.
      SetShellVarContext current
      RMDir /r "$APPDATA\AimTrainer"
      RMDir /r "$APPDATA\aim-trainer"
      RMDir /r "$APPDATA\AimTrainer-Backups"
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    ${EndIf}
  !macroend
!endif
