#ifndef _GDIPLUS_H
#define _GDIPLUS_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef int GpStatus;

typedef struct GdiplusStartupInput {
	UINT GdiplusVersion;
	void *DebugEventCallback;
	BOOL SuppressBackgroundThread;
	BOOL SuppressExternalCodecs;
} GdiplusStartupInput;

GpStatus WINAPI GdiplusStartup(
	ULONG_PTR *token,
	const GdiplusStartupInput *input,
	void *output
);
void WINAPI GdiplusShutdown(ULONG_PTR token);

#ifdef __cplusplus
}
#endif

#endif
