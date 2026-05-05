.PHONY: build clean install help link-zen unlink-zen

# Extension name and version
EXT_NAME = zen-tab-organizer
EXT_VERSION = 0.1.0
OUTPUT_FILE = $(EXT_NAME)-$(EXT_VERSION).xpi
ZEN_SRC ?= /home/beni/install/zen
ZEN_BRIDGE_DIR = $(ZEN_SRC)/src/zen/bridge/zen-spaces

BRIDGE_FILES = \
	experiments/zenSpaces.json \
	experiments/zenSpaces.js

help:
	@echo "Zen Tab Organizer - Makefile Commands"
	@echo "======================================"
	@echo "  make build    - Package extension as .xpi file"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make install  - Build and display install instructions"

build: clean
	@echo "Building extension: $(OUTPUT_FILE)"
	@mkdir -p dist
	zip -r dist/$(OUTPUT_FILE) \
		manifest.json \
		background.js \
		popup.html \
		popup.js \
		$(BRIDGE_FILES) \
		README.md \
		-x "*.git*" "*.DS_Store" "*.xpi" "*.zip" "Makefile" "dist/*"
	@echo "✓ Built: dist/$(OUTPUT_FILE)"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -f $(EXT_NAME)*.xpi
	@echo "✓ Clean complete"

install: build
	@echo ""
	@echo "Extension built successfully!"
	@echo ""
	@echo "To install in Zen Browser:"
	@echo "  1. Go to: about:debugging"
	@echo "  2. Click 'This Firefox'"
	@echo "  3. Click 'Load Temporary Add-on'"
	@echo "  4. Select: dist/$(OUTPUT_FILE)"
	@echo ""
	@echo "Or open directly:"
	@echo "  about:addons → Install from File → dist/$(OUTPUT_FILE)"
	@echo ""

link-zen:
	@echo "Linking bridge files into Zen source tree at $(ZEN_BRIDGE_DIR)"
	@mkdir -p $(ZEN_BRIDGE_DIR)
	@ln -sfn $(abspath experiments/zenSpaces/schema.json) $(ZEN_BRIDGE_DIR)/schema.json
	@ln -sfn $(abspath experiments/zenSpaces/implementation.js) $(ZEN_BRIDGE_DIR)/implementation.js
	@echo "✓ Linked Zen bridge files"

unlink-zen:
	@echo "Removing bridge symlinks from Zen source tree"
	@rm -f $(ZEN_BRIDGE_DIR)/schema.json $(ZEN_BRIDGE_DIR)/implementation.js
	@rmdir $(ZEN_BRIDGE_DIR) 2>/dev/null || true
	@echo "✓ Unlinked Zen bridge files"
