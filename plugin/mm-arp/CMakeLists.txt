cmake_minimum_required(VERSION 3.22)

# MM-ARP, le synthe arpegiateur du site en plugin VST3. Usage perso.
project(MM_ARP VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "macOS minimum")

option(MM_BUILD_PLUGIN "Construire le plugin JUCE (sinon : seulement le DSP et ses tests)" ON)
option(MM_HOST_TEST "Le banc du processeur sans fenetre (tests/host_test.cpp, Linux ou Mac), a la place du plugin" OFF)

# --- le DSP, sans JUCE ---
add_library(mmarp_dsp STATIC dsp/Voyager.cpp dsp/ArpFx.cpp dsp/Arp.cpp dsp/Params.cpp)
target_include_directories(mmarp_dsp PUBLIC dsp)
set_target_properties(mmarp_dsp PROPERTIES POSITION_INDEPENDENT_CODE ON)
# Le moteur est identique au bit pres au site (fdlibm de V8, dsp/Voyager.fdlibm.inc) : jamais de FMA, jamais de -ffast-math
target_compile_options(mmarp_dsp PRIVATE $<$<NOT:$<CXX_COMPILER_ID:MSVC>>:-ffp-contract=off> $<$<CXX_COMPILER_ID:MSVC>:/fp:precise>)

enable_testing()
add_executable(mmarp_arp_test tests/arp_test.cpp)
target_link_libraries(mmarp_arp_test PRIVATE mmarp_dsp)
add_test(NAME arp COMMAND mmarp_arp_test)
add_executable(mmarp_voyager_compare tests/voyager_compare.cpp)
target_link_libraries(mmarp_voyager_compare PRIVATE mmarp_dsp)
add_executable(mmarp_params_test tests/params_test.cpp)
target_link_libraries(mmarp_params_test PRIVATE mmarp_dsp)
add_executable(mmarp_fx_test tests/fx_test.cpp)
target_link_libraries(mmarp_fx_test PRIVATE mmarp_dsp)
add_executable(mmarp_hq_test tests/hq_test.cpp)
target_link_libraries(mmarp_hq_test PRIVATE mmarp_dsp)
add_test(NAME hq COMMAND mmarp_hq_test)

if(NOT MM_BUILD_PLUGIN)
  return()
endif()

# --- JUCE : un dossier local (JUCE_DIR) ou telecharge a la version figee ---
set(JUCE_DIR "" CACHE PATH "Un clone de JUCE deja present (sinon FetchContent)")
if(JUCE_DIR)
  add_subdirectory(${JUCE_DIR} juce)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

# Le banc du processeur : le vrai MMArpProcessor sans la WebView, joue comme sous Ableton (aucun son, des buffers)
if(MM_HOST_TEST)
  juce_add_console_app(mmarp_host_test PRODUCT_NAME "mmarp_host_test")
  target_sources(mmarp_host_test PRIVATE src/PluginProcessor.cpp tests/host_test.cpp)
  target_include_directories(mmarp_host_test PRIVATE src)
  target_compile_definitions(mmarp_host_test PRIVATE MMARP_HEADLESS=1 JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_STANDALONE_APPLICATION=1)
  target_link_libraries(mmarp_host_test PRIVATE mmarp_dsp juce::juce_audio_processors juce::juce_audio_utils
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)
  return()
endif()

juce_add_plugin(MM_ARP
  COMPANY_NAME "Maudite Machine"
  BUNDLE_ID "com.mauditemachine.mmarp"
  PLUGIN_MANUFACTURER_CODE Mmch
  PLUGIN_CODE Mmar
  PRODUCT_NAME "MM-ARP"
  FORMATS VST3
  IS_SYNTH TRUE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS TRUE
  VST3_CATEGORIES Instrument Synth
  COPY_PLUGIN_AFTER_BUILD FALSE)

# La face : le build de src/v4/plugin/arp (npm run plugin:arp:web -> build-web), en un zip dans le binaire
set(MM_WEB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/build-web")
if(NOT EXISTS "${MM_WEB_DIR}/index.html")
  message(FATAL_ERROR "La face n'est pas construite : lance `npm ci && npm run plugin:arp:web` a la racine du depot")
endif()
set(MM_WEB_ZIP "${CMAKE_CURRENT_BINARY_DIR}/web.zip")
file(REMOVE "${MM_WEB_ZIP}")
execute_process(COMMAND "${CMAKE_COMMAND}" -E tar cf "${MM_WEB_ZIP}" --format=zip .
  WORKING_DIRECTORY "${MM_WEB_DIR}" RESULT_VARIABLE MM_ZIP_RES)
if(NOT MM_ZIP_RES EQUAL 0)
  message(FATAL_ERROR "Zip de la face impossible")
endif()
juce_add_binary_data(mmarp_web HEADER_NAME WebData.h NAMESPACE WebData SOURCES "${MM_WEB_ZIP}")

target_sources(MM_ARP PRIVATE src/PluginProcessor.cpp src/PluginEditor.cpp)

target_compile_definitions(MM_ARP PUBLIC
  JUCE_WEB_BROWSER=1
  JUCE_USE_CURL=0
  JUCE_VST3_CAN_REPLACE_VST2=0
  JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(MM_ARP
  PRIVATE mmarp_dsp mmarp_web
    juce::juce_audio_utils juce::juce_audio_processors juce::juce_gui_extra
  PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_lto_flags juce::juce_recommended_warning_flags)
