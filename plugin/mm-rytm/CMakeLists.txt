cmake_minimum_required(VERSION 3.22)

# MM-RYTM, la boite a rythmes du site en plugin (VST3, AU, Standalone). Usage perso.
project(MM_RYTM VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "macOS minimum")

option(MM_BUILD_PLUGIN "Construire le plugin JUCE (sinon : seulement le DSP et ses tests)" ON)

# --- le DSP, sans JUCE ---
add_library(mm_dsp STATIC dsp/Shots.cpp dsp/Engine.cpp)
target_include_directories(mm_dsp PUBLIC dsp)
set_target_properties(mm_dsp PROPERTIES POSITION_INDEPENDENT_CODE ON)

enable_testing()
add_executable(mm_compare tests/compare.cpp)
target_link_libraries(mm_compare PRIVATE mm_dsp)
add_executable(mm_engine_test tests/engine_test.cpp)
target_link_libraries(mm_engine_test PRIVATE mm_dsp)
add_test(NAME engine COMMAND mm_engine_test)

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

juce_add_plugin(MM_RYTM
  COMPANY_NAME "Maudite Machine"
  BUNDLE_ID "com.mauditemachine.mmrytm"
  PLUGIN_MANUFACTURER_CODE Mmch
  PLUGIN_CODE Mmry
  PRODUCT_NAME "MM-RYTM"
  FORMATS VST3 AU Standalone
  IS_SYNTH TRUE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  VST3_CATEGORIES Instrument Drum
  AU_MAIN_TYPE kAudioUnitType_MusicDevice
  COPY_PLUGIN_AFTER_BUILD FALSE)

# Les samples de Mika (public/samples/rytm), embarques dans le binaire
file(GLOB_RECURSE MM_SAMPLE_FILES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/../../public/samples/rytm/*.wav")
juce_add_binary_data(mm_samples SOURCES ${MM_SAMPLE_FILES})

target_sources(MM_RYTM PRIVATE src/PluginProcessor.cpp src/PluginEditor.cpp src/SampleBank.cpp)

target_compile_definitions(MM_RYTM PUBLIC
  JUCE_WEB_BROWSER=0
  JUCE_USE_CURL=0
  JUCE_VST3_CAN_REPLACE_VST2=0
  JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(MM_RYTM
  PRIVATE mm_dsp mm_samples
    juce::juce_audio_utils juce::juce_audio_processors
  PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_lto_flags juce::juce_recommended_warning_flags)
