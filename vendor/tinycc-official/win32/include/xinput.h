#ifndef _XINPUT_H
#define _XINPUT_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _XINPUT_GAMEPAD {
	WORD wButtons;
	BYTE bLeftTrigger;
	BYTE bRightTrigger;
	SHORT sThumbLX;
	SHORT sThumbLY;
	SHORT sThumbRX;
	SHORT sThumbRY;
} XINPUT_GAMEPAD;

typedef struct _XINPUT_STATE {
	DWORD dwPacketNumber;
	XINPUT_GAMEPAD Gamepad;
} XINPUT_STATE;

typedef struct _XINPUT_VIBRATION {
	WORD wLeftMotorSpeed;
	WORD wRightMotorSpeed;
} XINPUT_VIBRATION;

DWORD WINAPI XInputGetState(DWORD user_index, XINPUT_STATE *state);
DWORD WINAPI XInputSetState(DWORD user_index, XINPUT_VIBRATION *vibration);

#ifdef __cplusplus
}
#endif

#endif
