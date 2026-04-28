document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const elements = {
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        namesInput: document.getElementById('names-input'),
        fileInput: document.getElementById('file-input'),
        fontFamily: document.getElementById('font-family'),
        fontColor: document.getElementById('font-color'),
        fontSize: document.getElementById('font-size'),
        fontWeight: document.getElementById('font-weight'),
        sizingMode: document.getElementById('sizing-mode'),
        dimensionsInputs: document.getElementById('dimensions-inputs'),
        gridInputs: document.getElementById('grid-inputs'),
        gridCols: document.getElementById('grid-cols'),
        gridRows: document.getElementById('grid-rows'),
        cardWidth: document.getElementById('card-width'),
        cardHeight: document.getElementById('card-height'),
        cardPadding: document.getElementById('card-padding'),
        cutGuides: document.getElementById('cut-guides'),
        pageSize: document.getElementById('page-size'),
        marginSize: document.getElementById('margin-size'),
        showMargins: document.getElementById('show-margins'),
        previewZoom: document.getElementById('preview-zoom'),
        previewContainer: document.getElementById('preview-container'),
        printContainer: document.getElementById('print-container'),
        printBtn: document.getElementById('print-btn'),
        previewStats: document.getElementById('preview-stats')
    };

    const PAGE_SIZES = {
        'A4': { width: 210, height: 297 },
        'Letter': { width: 215.9, height: 279.4 } // 8.5 x 11 inches in mm
    };

    const PAGE_MARGIN = 10; // mm margins on all sides

    let namesList = [];

    // Tabs functionality
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Inputs event listeners
    const triggerUpdate = () => updatePreview();

    elements.namesInput.addEventListener('input', () => {
        parseNames(elements.namesInput.value);
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                elements.namesInput.value = text;
                parseNames(text);
                elements.tabs[0].click(); // Switch to paste tab visually
            };
            reader.readAsText(file);
            
            // reset file input so the same file can be uploaded again if needed
            e.target.value = '';
        }
    });

    // Control listeners
    const controlElements = ['fontFamily', 'fontColor', 'fontSize', 'fontWeight', 'cardWidth', 'cardHeight', 'cardPadding', 'cutGuides', 'pageSize', 'sizingMode', 'gridCols', 'gridRows', 'marginSize', 'showMargins'];
    controlElements.forEach(key => {
        if (elements[key]) {
            elements[key].addEventListener('input', triggerUpdate);
            elements[key].addEventListener('change', triggerUpdate);
        }
    });

    elements.sizingMode.addEventListener('change', () => {
        if (elements.sizingMode.value === 'grid') {
            elements.dimensionsInputs.style.display = 'none';
            elements.gridInputs.style.display = 'flex';
        } else {
            elements.dimensionsInputs.style.display = 'flex';
            elements.gridInputs.style.display = 'none';
        }
    });

    elements.previewZoom.addEventListener('change', applyZoom);
    window.addEventListener('resize', () => {
        if (elements.previewZoom.value === 'fit') applyZoom();
    });

    // Parse names from text
    function parseNames(text) {
        if (!text.trim()) {
            namesList = [];
            updatePreview();
            return;
        }

        const raw = text.split(/\r?\n/);
        let parsed = [];
        
        raw.forEach(line => {
            // Check if line looks like comma separated values (and not just names like "Smith, John")
            // A simple heuristic: if there are multiple commas, or if there's no quote handling needed
            // Actually, a robust split is just to split by comma if we assume CSV. 
            // The prompt says "line or comma separated text". 
            // If the user pastes comma separated: a, b, c
            if (line.includes(',')) {
                // simple split
                parsed.push(...line.split(',').map(n => n.trim()).filter(n => n));
            } else {
                let cleanLine = line.trim();
                if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
                    cleanLine = cleanLine.substring(1, cleanLine.length - 1).trim();
                }
                if (cleanLine) {
                    parsed.push(cleanLine);
                }
            }
        });

        namesList = parsed;
        updatePreview();
    }

    // Main Update Function
    function updatePreview() {
        const settings = {
            fontFamily: elements.fontFamily.value,
            fontColor: elements.fontColor.value,
            fontSize: elements.fontSize.value + 'pt',
            fontWeight: elements.fontWeight.value,
            cardPadding: Math.max(0, parseFloat(elements.cardPadding.value) || 0),
            cutGuides: elements.cutGuides.value,
            pageSize: elements.pageSize.value
        };

        const pageDims = PAGE_SIZES[settings.pageSize];
        const currentMargin = Math.max(0, parseFloat(elements.marginSize.value) || 0);
        
        // Calculate printable area
        const printAreaWidth = pageDims.width - (currentMargin * 2);
        const printAreaHeight = pageDims.height - (currentMargin * 2);

        let cardWidth, cardHeight;
        if (elements.sizingMode.value === 'grid') {
            const gCols = Math.max(1, parseInt(elements.gridCols.value) || 2);
            const gRows = Math.max(1, parseInt(elements.gridRows.value) || 5);
            cardWidth = (printAreaWidth / gCols) - 0.01;
            cardHeight = (printAreaHeight / gRows) - 0.01;
        } else {
            cardWidth = Math.max(10, parseFloat(elements.cardWidth.value) || 90);
            cardHeight = Math.max(10, parseFloat(elements.cardHeight.value) || 50);
        }

        settings.cardWidth = cardWidth;
        settings.cardHeight = cardHeight;

        // Calculate how many cards fit
        const cols = Math.floor(printAreaWidth / settings.cardWidth);
        const rows = Math.floor(printAreaHeight / settings.cardHeight);
        
        // Ensure at least 1 card fits if size is weird
        const cardsPerPage = Math.max(1, cols * rows);
        
        // Default to showing a dummy card if no names
        const displayNames = namesList.length > 0 ? namesList : ['Guest Name'];
        
        // Clear containers
        elements.previewContainer.innerHTML = '';
        elements.printContainer.innerHTML = '';

        // Update stats
        const totalPages = Math.ceil(displayNames.length / cardsPerPage);
        const nameCount = namesList.length === 0 ? 0 : displayNames.length;
        elements.previewStats.textContent = `${nameCount} Card${nameCount !== 1 ? 's' : ''} • ${totalPages} Page${totalPages !== 1 ? 's' : ''}`;

        // Generate pages
        for (let p = 0; p < totalPages; p++) {
            // Preview Page
            const simPage = document.createElement('div');
            simPage.className = 'sim-page';
            simPage.style.width = `${pageDims.width}mm`;
            simPage.style.height = `${pageDims.height}mm`;
            simPage.style.padding = `${currentMargin}mm`;

            if (elements.showMargins.checked && currentMargin > 0) {
                const marginGuide = document.createElement('div');
                marginGuide.style.cssText = `
                    position: absolute;
                    top: ${currentMargin}mm;
                    left: ${currentMargin}mm;
                    right: ${currentMargin}mm;
                    bottom: ${currentMargin}mm;
                    border: 1px dashed rgba(255, 0, 0, 0.4);
                    pointer-events: none;
                    z-index: 10;
                `;
                simPage.appendChild(marginGuide);
            }

            // Print Page
            const printPage = document.createElement('div');
            printPage.className = 'print-page';
            printPage.style.width = `${pageDims.width}mm`;
            printPage.style.height = `${pageDims.height}mm`;
            printPage.style.padding = `${currentMargin}mm`;

            // Add cards to page
            const startIndex = p * cardsPerPage;
            const endIndex = Math.min(startIndex + cardsPerPage, displayNames.length);

            for (let i = startIndex; i < endIndex; i++) {
                const name = displayNames[i];
                
                const contentStyle = `
                    font-family: ${settings.fontFamily};
                    color: ${settings.fontColor};
                    font-size: ${settings.fontSize};
                    font-weight: ${settings.fontWeight};
                `;

                const cardStyle = `
                    width: ${settings.cardWidth}mm;
                    height: ${settings.cardHeight}mm;
                    padding: ${settings.cardPadding}mm;
                `;

                // Preview Card
                const simCard = document.createElement('div');
                simCard.className = `sim-card guide-${settings.cutGuides}`;
                simCard.style.cssText = cardStyle;
                simCard.innerHTML = `<span style="${contentStyle}">${escapeHtml(name)}</span>`;
                simPage.appendChild(simCard);

                // Print Card
                const printCard = document.createElement('div');
                printCard.className = `print-card guide-${settings.cutGuides}`;
                printCard.style.cssText = cardStyle;
                printCard.innerHTML = `<span style="${contentStyle}">${escapeHtml(name)}</span>`;
                printPage.appendChild(printCard);
            }

            elements.previewContainer.appendChild(simPage);
            elements.printContainer.appendChild(printPage);
        }

        updatePageCss(settings.pageSize);
        setTimeout(applyZoom, 0);
    }

    function applyZoom() {
        const val = elements.previewZoom.value;
        const pages = document.querySelectorAll('.sim-page');
        if (!pages.length) return;

        if (val === 'fit') {
            const containerWidth = elements.previewContainer.clientWidth - 96; 
            const containerHeight = elements.previewContainer.clientHeight - 96;
            
            pages.forEach(p => p.style.transform = 'none');
            const pageWidth = pages[0].offsetWidth;
            const pageHeight = pages[0].offsetHeight;
            
            const scaleX = containerWidth / pageWidth;
            const scaleY = containerHeight / pageHeight;
            const scale = Math.max(0.1, Math.min(scaleX, scaleY, 1));
            
            pages.forEach(p => {
                p.style.transform = `scale(${scale})`;
                p.style.transformOrigin = 'top center';
                p.style.marginBottom = `-${pageHeight * (1 - scale)}px`;
            });
        } else {
            const scale = parseFloat(val);
            pages.forEach(p => {
                p.style.transform = `scale(${scale})`;
                p.style.transformOrigin = 'top center';
                const pageHeight = p.offsetHeight;
                p.style.marginBottom = `-${pageHeight * (1 - scale)}px`;
            });
        }
    }

    function updatePageCss(pageSizeStr) {
        let styleTag = document.getElementById('dynamic-print-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-print-style';
            document.head.appendChild(styleTag);
        }
        
        const sizeStr = pageSizeStr === 'A4' ? 'A4' : 'letter';
        styleTag.innerHTML = `
            @media print {
                @page {
                    size: ${sizeStr};
                    margin: 0;
                }
            }
        `;
    }

    // Utility for safely rendering text
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    // Print functionality
    elements.printBtn.addEventListener('click', () => {
        if (namesList.length === 0) {
            alert('Please add some names first!');
            return;
        }
        window.print();
    });

    // Initial render
    updatePreview();
});
