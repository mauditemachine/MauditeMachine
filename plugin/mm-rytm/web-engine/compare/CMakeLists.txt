cmake_minimum_required(VERSION 3.22)

# La parite du moteur du navigateur avec le VST3 (compare_vst.cpp) : un projet a part, hors du build du plugin.
#   cmake -S plugin/mm-rytm/web-engine/compare -B build-compare -DCMAKE_BUILD_TYPE=Release [-DJUCE_DIR=/chemin/JUCE]
#   cmake --build build-compare -j --target mmrytm_compare_vst
#   ./build-compare/mmrytm_compare_vst_artefacts/Release/mmrytm_compare_vst [programme.json ...]
# Linux : les en-tetes X11 de JUCE (libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxext-dev
# libfreetype-dev libfontconfig-dev), aucun son.
project(MM_RYTM_COMPARE VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(MM_RYTM_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../..")

# le DSP et le moteur du navigateur, comme dans le depot (MM_BUILD_PLUGIN OFF : sans JUCE)
set(MM_BUILD_PLUGIN OFF CACHE BOOL "" FORCE)
add_subdirectory("${MM_RYTM_DIR}" mmrytm)

# JUCE a la version du plugin
set(JUCE_DIR "" CACHE PATH "Un clone de JUCE deja present (sinon FetchContent)")
if(JUCE_DIR)
  add_subdirectory(${JUCE_DIR} juce)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

# Les samples de Mika, embarques comme dans le plugin
file(GLOB_RECURSE MM_SAMPLE_FILES CONFIGURE_DEPENDS "${MM_RYTM_DIR}/../../public/samples/rytm/*.wav")
juce_add_binary_data(mmrytm_cmp_samples SOURCES ${MM_SAMPLE_FILES})

# Le processeur du VST3 tel quel (src/ copie sans changement dans le dossier de build), avec une fenetre vide a la place
# de la WebView (vst_editor_stub.h devient PluginEditor.h : createEditor n'est jamais appele)
set(MM_VST "${CMAKE_CURRENT_BINARY_DIR}/vst")
foreach(f PluginProcessor.cpp PluginProcessor.h SampleBank.cpp SampleBank.h)
  configure_file("${MM_RYTM_DIR}/src/${f}" "${MM_VST}/${f}" COPYONLY)
endforeach()
configure_file(vst_editor_stub.h "${MM_VST}/PluginEditor.h" COPYONLY)

juce_add_console_app(mmrytm_compare_vst PRODUCT_NAME "mmrytm_compare_vst")
target_sources(mmrytm_compare_vst PRIVATE "${MM_VST}/PluginProcessor.cpp" "${MM_VST}/SampleBank.cpp" compare_vst.cpp)
target_include_directories(mmrytm_compare_vst PRIVATE "${MM_VST}" "${MM_RYTM_DIR}/tests")
target_compile_definitions(mmrytm_compare_vst PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_STANDALONE_APPLICATION=1
  MM_SAMPLES_DIR="${MM_RYTM_DIR}/../../public/samples/rytm")
target_link_libraries(mmrytm_compare_vst PRIVATE mm_engine_web mmrytm_cmp_samples juce::juce_audio_processors
  PUBLIC juce::juce_recommended_config_flags)
