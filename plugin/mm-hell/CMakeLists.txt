cmake_minimum_required(VERSION 3.22)

# MM-HELL (2026-11-18), un plugin Maudite Machine (la famille de MM-RYTM et MM-ARP) : un delay infernal facon Echobode (un
# decaleur de frequence de Bode dans la boucle), effet audio VST3 avec une interface native (JUCE, sans WebView). Son moteur
# est celui du module HELL du MM-ARP. Usage perso.
project(MM_HELL VERSION 1.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "macOS minimum")

option(MM_BUILD_PLUGIN "Construire le plugin JUCE (sinon : seulement le DSP et ses tests)" ON)
option(MM_HOST_TEST "Les bancs sans hote : le processeur (tests/host_test.cpp), l'interface (tests/ui_test.cpp) et sa capture (tests/snapshot.cpp), a la place du plugin" OFF)

# --- le DSP, sans JUCE ---
# dsp/Hell.{h,cpp} : copie conforme de plugin/mm-arp/dsp/Hell.{h,cpp} (MM-ARP v31), compilee avec les memes options :
# le meme son au bit pres que le HELL du MM-ARP
add_library(mmhell_dsp STATIC dsp/Hell.cpp dsp/HellPatch.cpp)
target_include_directories(mmhell_dsp PUBLIC dsp)
set_target_properties(mmhell_dsp PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_compile_options(mmhell_dsp PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-ffp-contract=off> $<$<CXX_COMPILER_ID:MSVC>:/fp:precise>)
if(APPLE)
  target_compile_options(mmhell_dsp PRIVATE "SHELL:-Xarch_x86_64 -msse4.1")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|amd64" AND NOT MSVC)
  target_compile_options(mmhell_dsp PRIVATE -msse4.1)
endif()

enable_testing()
add_executable(mmhell_hell_test tests/hell_test.cpp)
target_link_libraries(mmhell_hell_test PRIVATE mmhell_dsp)
add_test(NAME hell COMMAND mmhell_hell_test)
add_executable(mmhell_presets_test tests/presets_test.cpp)
target_link_libraries(mmhell_presets_test PRIVATE mmhell_dsp)
add_test(NAME presets COMMAND mmhell_presets_test)

if(NOT MM_BUILD_PLUGIN)
  return()
endif()

# --- JUCE : un dossier local (JUCE_DIR) ou telecharge a la version figee (la meme que le MM-ARP) ---
set(JUCE_DIR "" CACHE PATH "Un clone de JUCE deja present (sinon FetchContent)")
if(JUCE_DIR)
  add_subdirectory(${JUCE_DIR} juce)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

# Les images (celles de la face du MM-ARP : potards, leviers, touches, cuir, bois) et les polices, dans le binaire
juce_add_binary_data(mmhell_assets HEADER_NAME HellAssets.h NAMESPACE HellAssets SOURCES
  assets/knob.png assets/knob-cap.png assets/key.png assets/leather.png
  assets/toggle-body.png assets/toggle-lever-off.png assets/toggle-lever-on.png assets/wood-l.jpg assets/wood-r.jpg
  assets/SF-Pro-Display-Medium.otf assets/SF-Pro-Display-Semibold.otf assets/SF-Pro-Display-Bold.otf assets/RobotRadicals.ttf)

set(MM_UI_SOURCES src/PluginEditor.cpp src/HellLook.cpp src/HellControls.cpp src/HellViews.cpp)
# MMHELL_VERSION : la version du projet (FIRMWARE V.1.0 dans l'en-tete, comme les autres machines Maudite Machine)
set(MM_JUCE_DEFS JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0 JUCE_DISPLAY_SPLASH_SCREEN=0
  MMHELL_VERSION="${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}")

# Le banc du processeur et la capture de l'interface (Linux ou Mac, sans hote ni son)
if(MM_HOST_TEST)
  juce_add_console_app(mmhell_host_test PRODUCT_NAME "mmhell_host_test")
  target_sources(mmhell_host_test PRIVATE src/PluginProcessor.cpp tests/host_test.cpp)
  target_include_directories(mmhell_host_test PRIVATE src)
  target_compile_definitions(mmhell_host_test PRIVATE MMHELL_HEADLESS=1 ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmhell_host_test PRIVATE mmhell_dsp juce::juce_audio_processors juce::juce_audio_utils
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  juce_add_console_app(mmhell_snapshot PRODUCT_NAME "mmhell_snapshot")
  target_sources(mmhell_snapshot PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES} tests/snapshot.cpp)
  target_include_directories(mmhell_snapshot PRIVATE src)
  target_compile_definitions(mmhell_snapshot PRIVATE ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmhell_snapshot PRIVATE mmhell_dsp mmhell_assets juce::juce_audio_processors juce::juce_audio_utils juce::juce_gui_extra
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  # les gestes de la souris sur la vraie fenetre -> les parametres de l'hote
  juce_add_console_app(mmhell_ui_test PRODUCT_NAME "mmhell_ui_test")
  target_sources(mmhell_ui_test PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES} tests/ui_test.cpp)
  target_include_directories(mmhell_ui_test PRIVATE src)
  target_compile_definitions(mmhell_ui_test PRIVATE ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmhell_ui_test PRIVATE mmhell_dsp mmhell_assets juce::juce_audio_processors juce::juce_audio_utils juce::juce_gui_extra
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  return()
endif()

juce_add_plugin(MM_HELL
  COMPANY_NAME "Maudite Machine"
  BUNDLE_ID "com.mauditemachine.mmhell"
  PLUGIN_MANUFACTURER_CODE Mmch
  PLUGIN_CODE Mmhl
  PRODUCT_NAME "MM-HELL"
  FORMATS VST3
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  VST3_CATEGORIES Fx Delay
  COPY_PLUGIN_AFTER_BUILD FALSE)

target_sources(MM_HELL PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES})
target_include_directories(MM_HELL PRIVATE src)
target_compile_definitions(MM_HELL PUBLIC ${MM_JUCE_DEFS})
target_link_libraries(MM_HELL
  PRIVATE mmhell_dsp mmhell_assets juce::juce_audio_utils juce::juce_audio_processors juce::juce_gui_extra
  PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_lto_flags juce::juce_recommended_warning_flags)
