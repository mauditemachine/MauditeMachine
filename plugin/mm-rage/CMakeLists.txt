cmake_minimum_required(VERSION 3.22)

# MM-RAGE (2026-11-18), un plugin Maudite Machine (la famille de MM-RYTM, MM-ARP et MM-HELL) : la DISTO du MM-ARP (facon
# Decapitator : douze styles, MORPH, multibande, dynamique, feedback, filtres, caisse, enveloppe et LFO), effet audio VST3
# avec une interface native (JUCE, sans WebView), en pages. Usage perso.
project(MM_RAGE VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "macOS minimum")

option(MM_BUILD_PLUGIN "Construire le plugin JUCE (sinon : seulement le DSP et ses tests)" ON)
option(MM_HOST_TEST "Les bancs sans hote : le processeur (tests/host_test.cpp), l'interface (tests/ui_test.cpp) et sa capture (tests/snapshot.cpp), a la place du plugin" OFF)

# --- le DSP, sans JUCE ---
# dsp/Decap.{h,cpp} : copie conforme de plugin/mm-arp/dsp/Decap.{h,cpp} (MM-ARP v32), compilee avec les memes options :
# le meme son au bit pres que la DISTO du MM-ARP
add_library(mmrage_dsp STATIC dsp/Decap.cpp dsp/RagePatch.cpp)
target_include_directories(mmrage_dsp PUBLIC dsp)
set_target_properties(mmrage_dsp PROPERTIES POSITION_INDEPENDENT_CODE ON)
target_compile_options(mmrage_dsp PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-ffp-contract=off> $<$<CXX_COMPILER_ID:MSVC>:/fp:precise>)
if(APPLE)
  target_compile_options(mmrage_dsp PRIVATE "SHELL:-Xarch_x86_64 -msse4.1")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "x86_64|AMD64|amd64" AND NOT MSVC)
  target_compile_options(mmrage_dsp PRIVATE -msse4.1)
endif()

enable_testing()
add_executable(mmrage_decap_test tests/decap_test.cpp)
target_link_libraries(mmrage_decap_test PRIVATE mmrage_dsp)
add_test(NAME decap COMMAND mmrage_decap_test)
add_executable(mmrage_presets_test tests/presets_test.cpp)
target_link_libraries(mmrage_presets_test PRIVATE mmrage_dsp)
add_test(NAME presets COMMAND mmrage_presets_test)

if(NOT MM_BUILD_PLUGIN)
  return()
endif()

# --- JUCE : un dossier local (JUCE_DIR) ou telecharge a la version figee (la meme que le MM-ARP et MM-HELL) ---
set(JUCE_DIR "" CACHE PATH "Un clone de JUCE deja present (sinon FetchContent)")
if(JUCE_DIR)
  add_subdirectory(${JUCE_DIR} juce)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

# Les images (celles de la face du MM-ARP : leviers, touches, cuir, bois ; les potards sont dessines en vectoriel) et les
# polices, dans le binaire
juce_add_binary_data(mmrage_assets HEADER_NAME RageAssets.h NAMESPACE RageAssets SOURCES
  assets/key.png assets/leather.png assets/toggle-body.png assets/toggle-lever-off.png assets/toggle-lever-on.png
  assets/wood-l.jpg assets/wood-r.jpg
  assets/SF-Pro-Display-Medium.otf assets/SF-Pro-Display-Semibold.otf assets/SF-Pro-Display-Bold.otf assets/RobotRadicals.ttf)

set(MM_UI_SOURCES src/PluginEditor.cpp src/RageLook.cpp src/RageControls.cpp src/RageViews.cpp)
# MMRAGE_VERSION : la version du projet (FIRMWARE V.1.0 dans l'en-tete, comme les autres machines Maudite Machine)
set(MM_JUCE_DEFS JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0 JUCE_DISPLAY_SPLASH_SCREEN=0
  MMRAGE_VERSION="${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}")

# Le banc du processeur et la capture de l'interface (Linux ou Mac, sans hote ni son)
if(MM_HOST_TEST)
  juce_add_console_app(mmrage_host_test PRODUCT_NAME "mmrage_host_test")
  target_sources(mmrage_host_test PRIVATE src/PluginProcessor.cpp tests/host_test.cpp)
  target_include_directories(mmrage_host_test PRIVATE src)
  target_compile_definitions(mmrage_host_test PRIVATE MMRAGE_HEADLESS=1 ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmrage_host_test PRIVATE mmrage_dsp juce::juce_audio_processors juce::juce_audio_utils
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  juce_add_console_app(mmrage_snapshot PRODUCT_NAME "mmrage_snapshot")
  target_sources(mmrage_snapshot PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES} tests/snapshot.cpp)
  target_include_directories(mmrage_snapshot PRIVATE src)
  target_compile_definitions(mmrage_snapshot PRIVATE ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmrage_snapshot PRIVATE mmrage_dsp mmrage_assets juce::juce_audio_processors juce::juce_audio_utils juce::juce_gui_extra
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  # les gestes de la souris sur la vraie fenetre -> les parametres de l'hote
  juce_add_console_app(mmrage_ui_test PRODUCT_NAME "mmrage_ui_test")
  target_sources(mmrage_ui_test PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES} tests/ui_test.cpp)
  target_include_directories(mmrage_ui_test PRIVATE src)
  target_compile_definitions(mmrage_ui_test PRIVATE ${MM_JUCE_DEFS} JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmrage_ui_test PRIVATE mmrage_dsp mmrage_assets juce::juce_audio_processors juce::juce_audio_utils juce::juce_gui_extra
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  return()
endif()

juce_add_plugin(MM_RAGE
  COMPANY_NAME "Maudite Machine"
  BUNDLE_ID "com.mauditemachine.mmrage"
  PLUGIN_MANUFACTURER_CODE Mmch
  PLUGIN_CODE Mmrg
  PRODUCT_NAME "MM-RAGE"
  FORMATS VST3
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  VST3_CATEGORIES Fx Distortion
  COPY_PLUGIN_AFTER_BUILD FALSE)

target_sources(MM_RAGE PRIVATE src/PluginProcessor.cpp ${MM_UI_SOURCES})
target_include_directories(MM_RAGE PRIVATE src)
target_compile_definitions(MM_RAGE PUBLIC ${MM_JUCE_DEFS})
target_link_libraries(MM_RAGE
  PRIVATE mmrage_dsp mmrage_assets juce::juce_audio_utils juce::juce_audio_processors juce::juce_gui_extra
  PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_lto_flags juce::juce_recommended_warning_flags)
