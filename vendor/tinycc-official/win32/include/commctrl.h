#ifndef _COMMCTRL_H
#define _COMMCTRL_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct tagINITCOMMONCONTROLSEX {
	DWORD dwSize;
	DWORD dwICC;
} INITCOMMONCONTROLSEX, *LPINITCOMMONCONTROLSEX;

WINBOOL WINAPI InitCommonControlsEx(const INITCOMMONCONTROLSEX *controls);

#define ICC_STANDARD_CLASSES 0x00004000

#ifdef __cplusplus
}
#endif

#endif
