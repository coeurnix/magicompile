#ifndef _SHELLAPI_H
#define _SHELLAPI_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

HINSTANCE WINAPI ShellExecuteA(
	HWND hwnd,
	LPCSTR operation,
	LPCSTR file,
	LPCSTR parameters,
	LPCSTR directory,
	INT show
);
HINSTANCE WINAPI ShellExecuteW(
	HWND hwnd,
	LPCWSTR operation,
	LPCWSTR file,
	LPCWSTR parameters,
	LPCWSTR directory,
	INT show
);

#ifdef UNICODE
#define ShellExecute ShellExecuteW
#else
#define ShellExecute ShellExecuteA
#endif

#ifdef __cplusplus
}
#endif

#endif
