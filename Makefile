.PHONY: build clean install help link-zen unlink-zen

# Extension name and version
EXT_NAME = zen-tab-organizer
EXT_VERSION = 0.1.0
OUTPUT_FILE = $(EXT_NAME)-$(EXT_VERSION).xpi

BRIDGE_FILES = \
	experiments/zenSpaces.json \
	experiments/zenSpaces.js

build: clean
	@mkdir -p dist
	zip -r dist/$(OUTPUT_FILE) \
		manifest.json \
		background.js \
		popup.html \
		popup.js \
		$(BRIDGE_FILES)\
		README.md

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist
	rm -f $(EXT_NAME)*.xpi