// Voir MacFileDrag.h. Objective-C++ : compile avec ou sans ARC.
#include "MacFileDrag.h"

#include <utility>

#import <AppKit/AppKit.h>

#if __has_feature(objc_arc)
 #define MM_AUTORELEASE(x) (x)
 #define MM_VIEW(p) ((__bridge NSView*) (p))
#else
 #define MM_AUTORELEASE(x) [(x) autorelease]
 #define MM_VIEW(p) ((NSView*) (p))
#endif

// La source du glisser : une copie, et la fin du glisser rendue au plugin.
@interface MMRytmFileDragSource : NSObject <NSDraggingSource>
{
@public
    std::function<void()> onEnd;
}
@end

@implementation MMRytmFileDragSource

- (NSDragOperation) draggingSession: (NSDraggingSession*) session sourceOperationMaskForDraggingContext: (NSDraggingContext) context
{
    (void) session;
    (void) context;
    return NSDragOperationCopy;
}

- (void) draggingSession: (NSDraggingSession*) session endedAtPoint: (NSPoint) screenPoint operation: (NSDragOperation) operation
{
    (void) session;
    (void) screenPoint;
    (void) operation;
    if (onEnd)
    {
        std::function<void()> f = onEnd;
        onEnd = nullptr;
        @try
        {
            f();
        }
        @catch (NSException*)
        {
        }
    }
}

@end

namespace mm {

std::string startFileDrag(void* nsView, const std::string& utf8Path, std::function<void()> onEnd)
{
    @autoreleasepool
    {
        @try
        {
            NSView* view = MM_VIEW(nsView);
            if (view == nil) return "no view";
            NSWindow* win = [view window];
            if (win == nil) return "no window";
            // Sans bouton enfonce, un glisser resterait accroche a la souris
            if (([NSEvent pressedMouseButtons] & 1) == 0) return "the mouse button is up";

            NSString* path = [NSString stringWithUTF8String: utf8Path.c_str()];
            if (path == nil || [path length] == 0) return "bad path";
            if (! [[NSFileManager defaultManager] fileExistsAtPath: path]) return "no file";
            NSURL* url = [NSURL fileURLWithPath: path];
            if (url == nil) return "bad path";

            // L'evenement du glisser : fabrique, a la position de la souris dans la fenetre (jamais [NSApp currentEvent], qui peut
            // etre n'importe quel evenement quand la demande vient de la WebView)
            const NSPoint inWin = [win mouseLocationOutsideOfEventStream];
            NSEvent* ev = [NSEvent mouseEventWithType: NSEventTypeLeftMouseDragged
                                             location: inWin
                                        modifierFlags: 0
                                            timestamp: [[NSProcessInfo processInfo] systemUptime]
                                         windowNumber: [win windowNumber]
                                              context: nil
                                          eventNumber: 0
                                           clickCount: 1
                                             pressure: 1.0f];
            if (ev == nil) return "no event";

            NSDraggingItem* item = MM_AUTORELEASE([[NSDraggingItem alloc] initWithPasteboardWriter: url]);
            if (item == nil) return "no item";
            const NSPoint inView = [view convertPoint: inWin fromView: nil];
            NSImage* icon = [[NSWorkspace sharedWorkspace] iconForFile: path];
            [item setDraggingFrame: NSMakeRect(inView.x - 16.0, inView.y - 16.0, 32.0, 32.0) contents: icon];

            MMRytmFileDragSource* src = MM_AUTORELEASE([[MMRytmFileDragSource alloc] init]);
            if (src == nil) return "no source";
            src->onEnd = std::move(onEnd);

            NSDraggingSession* session = [view beginDraggingSessionWithItems: [NSArray arrayWithObject: item] event: ev source: src];
            if (session == nil)
            {
                src->onEnd = nullptr;
                return "the session did not start";
            }
            return std::string();
        }
        @catch (NSException* e)
        {
            (void) e;
            return "macOS refused the drag";
        }
    }
    return "no drag";
}

} // namespace mm
