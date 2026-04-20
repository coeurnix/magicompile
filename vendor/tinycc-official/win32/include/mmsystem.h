#ifndef _MMSYSTEM_H
#define _MMSYSTEM_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef DWORD MCIERROR;

BOOL WINAPI PlaySoundA(LPCSTR sound, HMODULE module, DWORD flags);
BOOL WINAPI PlaySoundW(LPCWSTR sound, HMODULE module, DWORD flags);
MCIERROR WINAPI mciSendStringA(
	LPCSTR command,
	LPSTR return_string,
	UINT return_length,
	HANDLE callback
);
MCIERROR WINAPI mciSendStringW(
	LPCWSTR command,
	LPWSTR return_string,
	UINT return_length,
	HANDLE callback
);

#define SND_SYNC 0x0000
#define SND_ASYNC 0x0001

#ifdef UNICODE
#define PlaySound PlaySoundW
#define mciSendString mciSendStringW
#else
#define PlaySound PlaySoundA
#define mciSendString mciSendStringA
#endif

#ifdef __cplusplus
}
#endif

#endif
