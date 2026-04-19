#include <emscripten/emscripten.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

#include "libtcc.h"

#define ERROR_BUFFER_SIZE 16384

static char last_error[ERROR_BUFFER_SIZE];

static void clear_error_buffer(void)
{
	last_error[0] = '\0';
}

static void append_error_line(const char *message)
{
	size_t length;
	size_t remaining;

	if (!message || !message[0]) {
		return;
	}

	length = strlen(last_error);
	remaining = ERROR_BUFFER_SIZE - length;

	if (remaining <= 1) {
		return;
	}

	if (length > 0) {
		snprintf(last_error + length, remaining, "\n%s", message);
	} else {
		snprintf(last_error, remaining, "%s", message);
	}
}

static void append_errorf(const char *format, ...)
{
	va_list arguments;
	char buffer[512];

	va_start(arguments, format);
	vsnprintf(buffer, sizeof(buffer), format, arguments);
	va_end(arguments);

	append_error_line(buffer);
}

static void capture_tcc_error(void *opaque, const char *message)
{
	(void)opaque;
	append_error_line(message);
}

static void ensure_directory(const char *path)
{
	if (mkdir(path, 0777) != 0 && errno != EEXIST) {
		append_errorf("Unable to create directory %s", path);
	}
}

static int source_uses_windows_entry(const char *source_code)
{
	return strstr(source_code, "WinMain(") != NULL
		|| strstr(source_code, "wWinMain(") != NULL;
}

static int add_default_windows_libraries(TCCState *state)
{
	static const char *const libraries[] = {
		"advapi32",
		"comctl32",
		"comdlg32",
		"gdiplus",
		"ole32",
		"oleaut32",
		"shell32",
		"shlwapi",
		"winmm",
		"ws2_32",
		"xinput1_4",
	};
	size_t index;

	for (index = 0; index < sizeof(libraries) / sizeof(libraries[0]); index++) {
		if (tcc_add_library(state, libraries[index]) < 0) {
			append_errorf("Failed to link %s.", libraries[index]);
			return 0;
		}
	}

	return 1;
}

static char *build_compilation_unit(const char *source_code)
{
	static const char prefix[] =
		"#include <tccdefs.h>\n"
		"__asm__(\".section .init_array,\\\"aw\\\"\\n\"\n"
		"        \".global __init_array_start\\n\"\n"
		"        \"__init_array_start:\\n\"\n"
		"        \".global __init_array_end\\n\"\n"
		"        \"__init_array_end:\\n\"\n"
		"        \".section .fini_array,\\\"aw\\\"\\n\"\n"
		"        \".global __fini_array_start\\n\"\n"
		"        \"__fini_array_start:\\n\"\n"
		"        \".global __fini_array_end\\n\"\n"
		"        \"__fini_array_end:\\n\"\n"
		"        \".text\\n\");\n"
		"#line 1 \"input.c\"\n";
	size_t source_length = strlen(source_code);
	size_t total_length = sizeof(prefix) - 1 + source_length + 1;
	char *buffer = malloc(total_length);

	if (!buffer) {
		append_error_line("Unable to allocate memory for the TinyCC input buffer.");
		return NULL;
	}

	memcpy(buffer, prefix, sizeof(prefix) - 1);
	memcpy(buffer + sizeof(prefix) - 1, source_code, source_length + 1);
	return buffer;
}

EMSCRIPTEN_KEEPALIVE int tcc_compile_to_exe(
	const char *source_code,
	const char *output_path
)
{
	TCCState *state;
	char *compilation_unit;

	clear_error_buffer();

	if (!source_code || !output_path) {
		append_error_line("Missing source code or output path.");
		return 0;
	}

	ensure_directory("/tmp");
	ensure_directory("/tmp/out");
	remove(output_path);

	state = tcc_new();
	if (!state) {
		append_error_line("Failed to create the TinyCC compiler state.");
		return 0;
	}

	tcc_set_error_func(state, NULL, capture_tcc_error);
	tcc_set_lib_path(state, "/tcc/win32");
	if (source_uses_windows_entry(source_code)) {
		tcc_set_options(state, "-Wl,-subsystem=windows");
	} else {
		tcc_set_options(state, "");
	}

	if (tcc_set_output_type(state, TCC_OUTPUT_EXE) < 0) {
		append_error_line("Failed to switch TinyCC into executable output mode.");
		tcc_delete(state);
		return 0;
	}

	compilation_unit = build_compilation_unit(source_code);
	if (!compilation_unit) {
		tcc_delete(state);
		return 0;
	}

	if (tcc_compile_string(state, compilation_unit) < 0) {
		free(compilation_unit);
		tcc_delete(state);
		return 0;
	}
	free(compilation_unit);

	if (!add_default_windows_libraries(state)) {
		tcc_delete(state);
		return 0;
	}

	if (tcc_output_file(state, output_path) < 0) {
		tcc_delete(state);
		return 0;
	}

	tcc_delete(state);
	return 1;
}

EMSCRIPTEN_KEEPALIVE const char *tcc_last_error(void)
{
	return last_error;
}
