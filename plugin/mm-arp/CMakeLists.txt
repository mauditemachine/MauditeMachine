cmake_minimum_required(VERSION 3.22)

# MM-ARP, le synthe arpegiateur du site en plugin VST3. Usage perso.
project(MM_ARP VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "macOS minimum")

option(MM_BUILD_PLUGIN "Construire le plugin JUCE (sinon : seulement le DSP et ses tests)" ON)

# --- le DSP, sans JUCE ---
add_library(mmarp_dsp STATIC dsp/Voyager.cpp dsp/ArpFx.cpp dsp/Arp.cpp)
target_include_directories(mmarp_dsp PUBLIC dsp)
set_target_properties(mmarp_dsp PROPERTIES POSITION_INDEPENDENT_CODE ON)

enable_testing()
add_executable(mmarp_arp_test tests/arp_test.cpp)
target_link_libraries(mmarp_arp_test PRIVATE mmarp_dsp)
add_test(NAME arp COMMAND mmarp_arp_test)
#@TESTS@

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
