cmake_minimum_required(VERSION 3.22)

# La parite du moteur du navigateur avec le VST3 (compare_vst.cpp) : un projet a part, hors du build du plugin.
#   cmake -S plugin/mm-arp/web-engine/compare -B build-compare -DCMAKE_BUILD_TYPE=Release [-DJUCE_DIR=/chemin/JUCE]
#   cmake --build build-compare -j --target mmarp_compare_vst
#   ./build-compare/mmarp_compare_vst_artefacts/Release/mmarp_compare_vst
# Linux : les en-tetes X11 de JUCE (libx11-dev libxrandr-dev libxinerama-dev libxcursor-dev libxext-dev
# libfreetype-dev libfontconfig-dev), aucun son.
project(MM_ARP_COMPARE VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(MM_ARP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../..")

# le DSP et le moteur du navigateur, comme dans le depot (MM_BUILD_PLUGIN OFF : sans JUCE)
set(MM_BUILD_PLUGIN OFF CACHE BOOL "" FORCE)
add_subdirectory("${MM_ARP_DIR}" mmarp)

# JUCE a la version du plugin
set(JUCE_DIR "" CACHE PATH "Un clone de JUCE deja present (sinon FetchContent)")
if(JUCE_DIR)
  add_subdirectory(${JUCE_DIR} juce)
else()
  include(FetchContent)
  FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
  FetchContent_MakeAvailable(JUCE)
endif()

juce_add_console_app(mmarp_compare_vst PRODUCT_NAME "mmarp_compare_vst")
target_sources(mmarp_compare_vst PRIVATE "${MM_ARP_DIR}/src/PluginProcessor.cpp" compare_vst.cpp)
target_include_directories(mmarp_compare_vst PRIVATE "${MM_ARP_DIR}/src" "${MM_ARP_DIR}/tests")
target_compile_definitions(mmarp_compare_vst PRIVATE MMARP_HEADLESS=1 JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_STANDALONE_APPLICATION=1
  MMARP_FACTORY_JSON="${MM_ARP_DIR}/presets/factory.json")
target_link_libraries(mmarp_compare_vst PRIVATE mmarp_engine juce::juce_audio_processors
  PUBLIC juce::juce_recommended_config_flags)
