#ifndef _WINSOCK2_H
#define _WINSOCK2_H

#include <windows.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef UINT_PTR SOCKET;
typedef unsigned short u_short;
typedef unsigned int u_int;
typedef unsigned long u_long;

struct in_addr {
	union {
		struct {
			BYTE s_b1;
			BYTE s_b2;
			BYTE s_b3;
			BYTE s_b4;
		} S_un_b;
		u_long S_addr;
	} S_un;
};

struct sockaddr {
	u_short sa_family;
	char sa_data[14];
};

struct sockaddr_in {
	short sin_family;
	u_short sin_port;
	struct in_addr sin_addr;
	char sin_zero[8];
};

typedef struct WSADataA {
	WORD wVersion;
	WORD wHighVersion;
	char szDescription[257];
	char szSystemStatus[129];
	unsigned short iMaxSockets;
	unsigned short iMaxUdpDg;
	char *lpVendorInfo;
} WSADATA, WSAData;

#define INVALID_SOCKET ((SOCKET)(~0))
#define SOCKET_ERROR (-1)
#define AF_INET 2
#define SOCK_STREAM 1
#define IPPROTO_TCP 6

int WINAPI WSAStartup(WORD version, WSADATA *data);
int WINAPI WSACleanup(void);
int WINAPI closesocket(SOCKET socket_handle);
u_short WINAPI htons(u_short hostshort);
u_long WINAPI htonl(u_long hostlong);
u_long WINAPI inet_addr(const char *cp);
SOCKET WINAPI socket(int af, int type, int protocol);
int WINAPI connect(SOCKET socket_handle, const struct sockaddr *name, int namelen);
int WINAPI bind(SOCKET socket_handle, const struct sockaddr *name, int namelen);
int WINAPI listen(SOCKET socket_handle, int backlog);
SOCKET WINAPI accept(SOCKET socket_handle, struct sockaddr *addr, int *addrlen);
int WINAPI send(SOCKET socket_handle, const char *buffer, int len, int flags);
int WINAPI recv(SOCKET socket_handle, char *buffer, int len, int flags);

#ifdef __cplusplus
}
#endif

#endif
