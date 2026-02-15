let currentAlbumId = null;
let currentDeckId = null;
let currentDeckCardId = null; // New for deck card editing
let currentSlotIndex = null;
let currentPageId = null;
let currentUser = null;
let editingType = 'slot'; // 'slot' or 'deck-card'

// Mask Editor State
let maskCanvas, maskCtx;
let isPainting = false;
let currentBrushSize = 10;
let currentTool = 'brush'; // 'brush' or 'eraser'
let maskHistory = [];
const MAX_HISTORY = 20;

let droppedGltfFile = null;
let droppedExtraFiles = [];

$(document).ready(function() {
    checkSession();
    initTheme();

    // --- Navigation (Dashboard Tiles) ---
    $(document).on('click', '#btn-home', function(e) {
        e.preventDefault();
        showView('main-dashboard');
    });

    $(document).on('click', '#btn-show-albums', function(e) {
        e.preventDefault();
        showView('dashboard');
        loadAlbums();
    });

    $(document).on('click', '#btn-show-decks', function(e) {
        e.preventDefault();
        showView('decks');
        loadDecks();
    });

    $(document).on('click', '#btn-show-spirits', function(e) {
        e.preventDefault();
        showView('spirits');
        loadSpirits();
    });

    $(document).on('click', '#btn-logout-tile', function(e) {
        e.preventDefault();
        handleLogout();
    });

    // --- Floating Panel Logic ---
    $(document).on('click', '#avatar-btn', function(e) {
        e.stopPropagation();
        $('#user-dropdown').toggleClass('active');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.user-menu-container').length) {
            $('#user-dropdown').removeClass('active');
        }
    });

    $('.theme-btn-small').on('click', function() {
        const theme = $(this).data('theme');
        applyTheme(theme);
    });

    $('#menu-btn-home').click(function(e) { e.preventDefault(); showView('main-dashboard'); $('#user-dropdown').removeClass('active'); });
    $('#menu-btn-albums').click(function(e) { e.preventDefault(); showView('dashboard'); loadAlbums(); $('#user-dropdown').removeClass('active'); });
    $('#menu-btn-decks').click(function(e) { e.preventDefault(); showView('decks'); loadDecks(); $('#user-dropdown').removeClass('active'); });
    $('#menu-btn-spirits').click(function(e) { e.preventDefault(); showView('spirits'); loadSpirits(); $('#user-dropdown').removeClass('active'); });
    $('#menu-btn-logout').click(function(e) { e.preventDefault(); handleLogout(); });

    // --- Back Buttons ---
    $(document).on('click', '#btn-back-to-main, .btn-back-main', function(e) {
        e.preventDefault();
        showView('main-dashboard');
    });

    $(document).on('click', '#btn-back-to-albums', function(e) {
        e.preventDefault();
        showView('dashboard');
        loadAlbums();
    });

    // Zoom Toggle (Admin)
    // Spirit Navigation
    $('#btn-prev-spirit-admin').click(function() {
        if (!window.allSpirits || window.allSpirits.length <= 1) return;
        window.currentSpiritIndex = (window.currentSpiritIndex - 1 + window.allSpirits.length) % window.allSpirits.length;
        updateMainViewer(window.allSpirits[window.currentSpiritIndex], window.selectedSpiritId);
    });

    $('#btn-next-spirit-admin').click(function() {
        if (!window.allSpirits || window.allSpirits.length <= 1) return;
        window.currentSpiritIndex = (window.currentSpiritIndex + 1) % window.allSpirits.length;
        updateMainViewer(window.allSpirits[window.currentSpiritIndex], window.selectedSpiritId);
    });

    $('#btn-toggle-zoom-admin').on('click', function() {
        const viewer = document.getElementById('main-spirit-viewer');
        const icon = $(this).find('i');

        if (viewer.hasAttribute('disable-zoom')) {
            viewer.removeAttribute('disable-zoom');
            icon.removeClass('fa-search-plus').addClass('fa-search-minus');
            $(this).css('background', 'rgba(0, 210, 255, 0.6)');
            Swal.fire({
                title: 'Zoom Activado',
                text: 'Ahora puedes usar la rueda del ratón o pellizcar para hacer zoom.',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        } else {
            viewer.setAttribute('disable-zoom', '');
            icon.removeClass('fa-search-minus').addClass('fa-search-plus');
            $(this).css('background', 'rgba(0,0,0,0.5)');
        }
    });

    // Authentication Actions
    $('#btn-login').click(function(e) {
        e.preventDefault();
        handleLogin();
    });
    $('#btn-logout').click(function(e) {
        e.preventDefault();
        handleLogout();
    });

    // Navigation
    $('#btn-dashboard').click(function(e) {
        e.preventDefault();
        showView('dashboard');
        loadAlbums();
    });

    $('#btn-decks').click(function(e) {
        e.preventDefault();
        showView('decks');
        loadDecks();
    });

    $('#btn-spirits').click(function(e) {
        e.preventDefault();
        showView('spirits');
        loadSpirits();
    });

    $('#btn-create-album').click(async function(e) {
        e.preventDefault();
        if (!currentUser) return;

        const { data, error } = await _supabase
            .from('albums')
            .insert([{ title: 'Nuevo Álbum', user_id: currentUser.id }])
            .select();

        if (error) {
            Swal.fire('Error', 'No se pudo crear el álbum', 'error');
            console.error(error);
        } else {
            loadAlbums();
        }
    });

    // Album Meta Save
    $('#btn-save-album-meta').click(async function(e) {
        e.preventDefault();
        const title = $('#input-album-title').val();
        const cover = $('#input-album-cover').val();
        const back = $('#input-album-back').val();
        const coverColor = $('#input-album-cover-color').val();
        const backColor = $('#input-album-back-color').val();
        const is_public = $('#input-album-public').is(':checked');

        let updateData = {
            title,
            cover_image_url: cover,
            back_image_url: back,
            cover_color: coverColor,
            back_color: backColor,
            is_public
        };
        let { error } = await _supabase
            .from('albums')
            .update(updateData)
            .eq('id', currentAlbumId);

        // Fallback for missing column
        if (error && (error.code === '42703' || (error.message && error.message.includes('is_public')))) {
            console.warn("is_public column missing, retrying update without it.");
            delete updateData.is_public;
            const retry = await _supabase
                .from('albums')
                .update(updateData)
                .eq('id', currentAlbumId);
            error = retry.error;
        }

        if (error) {
            Swal.fire('Error', 'No se pudieron guardar los cambios: ' + (error.message || ''), 'error');
            console.error(error);
        } else {
            Swal.fire({
                title: '¡Actualizado!',
                text: 'El álbum se ha actualizado correctamente',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
            loadAlbums();
            showView('dashboard');
        }
    });

    // Page Management
    $('#btn-add-page').click(async function(e) {
        e.preventDefault();
        const { data: pages } = await _supabase
            .from('pages')
            .select('page_index')
            .eq('album_id', currentAlbumId)
            .order('page_index', { ascending: false })
            .limit(1);

        const nextIndex = (pages && pages.length > 0) ? pages[0].page_index + 1 : 0;

        const { data, error } = await _supabase
            .from('pages')
            .insert([{ album_id: currentAlbumId, page_index: nextIndex }])
            .select();

        if (error) {
            Swal.fire('Error', 'No se pudo añadir la página', 'error');
            console.error(error);
        } else {
            loadAlbumPages(currentAlbumId, false);
        }
    });

    // Slot Management
    $(document).on('click', '.card-slot', function() {
        currentPageId = $(this).closest('.admin-page-item').data('id');
        currentSlotIndex = $(this).data('index');
        loadSlotData(currentPageId, currentSlotIndex);
    });

    $('#btn-save-slot').click(async function(e) {
        e.preventDefault();
        const cardData = {
            image_url: $('#slot-image-url').val(),
            name: $('#slot-name').val(),
            holo_effect: $('#slot-holo-effect').val(),
            custom_mask_url: $('#slot-custom-mask').val(),
            rarity: $('#slot-rarity').val(),
            expansion: $('#slot-expansion').val(),
            condition: $('#slot-condition').val(),
            quantity: $('#slot-quantity').val(),
            price: $('#slot-price').val()
        };

        let error;
        if (editingType === 'slot') {
            const slotData = { ...cardData, page_id: currentPageId, slot_index: currentSlotIndex };
            const result = await _supabase
                .from('card_slots')
                .upsert(slotData, { onConflict: 'page_id,slot_index' });
            error = result.error;
        } else {
            const result = await _supabase
                .from('deck_cards')
                .update(cardData)
                .eq('id', currentDeckCardId);
            error = result.error;
        }

        if (error) {
            Swal.fire('Error', 'No se pudo guardar la información de la carta: ' + (error.message || ''), 'error');
            console.error(error);
        } else {
            Swal.fire({
                title: 'Guardado',
                text: 'Carta actualizada',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
            $('#slot-modal').removeClass('active');
            if (editingType === 'slot') {
                loadAlbumPages(currentAlbumId);
            } else {
                loadDeckCards(currentDeckId);
            }
        }
    });

    $('#close-slot-modal').click(function() {
        $('#slot-modal').removeClass('active');
    });

    $('#slot-holo-effect').change(function() {
        if ($(this).val() === 'custom-texture') {
            $('#custom-mask-container').show();
        } else {
            $('#custom-mask-container').hide();
        }
    });

    // --- Mask Editor Logic ---
    maskCanvas = document.getElementById('mask-canvas');
    if (maskCanvas) maskCtx = maskCanvas.getContext('2d');

    $('#btn-open-mask-editor').click(function(e) {
        e.preventDefault();
        const cardImgUrl = $('#slot-image-url').val();
        if (!cardImgUrl) {
            Swal.fire('Atención', 'Primero debes poner la URL de la imagen de la carta para usar de referencia.', 'warning');
            return;
        }

        // Set card as background
        $('#mask-canvas-wrapper').css('background-image', `url(${cardImgUrl})`);

        // Initialize canvas
        initMaskCanvas();

        $('#mask-editor-overlay').addClass('active');
    });

    $('#close-mask-editor').click(function() {
        $('#mask-editor-overlay').removeClass('active');
    });

    $('#brush-size').on('input', function() {
        currentBrushSize = $(this).val();
        $('#brush-size-val').text(currentBrushSize);
    });

    $('#tool-brush').click(function() {
        currentTool = 'brush';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
    });

    $('#tool-eraser').click(function() {
        currentTool = 'eraser';
        $('.editor-controls .btn-secondary').removeClass('active');
        $(this).addClass('active');
    });

    $('#btn-clear-mask').click(function() {
        Swal.fire({
            title: '¿Limpiar todo?',
            text: "Se borrará todo el dibujo de la máscara.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, limpiar'
        }).then((result) => {
            if (result.isConfirmed) {
                saveMaskHistory();
                maskCtx.fillStyle = 'black';
                maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                // Also clear the input field as requested
                $('#slot-custom-mask').val('');
            }
        });
    });

    $('#btn-undo-mask').click(function() {
        if (maskHistory.length > 0) {
            const lastState = maskHistory.pop();
            const img = new Image();
            img.onload = function() {
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                maskCtx.drawImage(img, 0, 0);
            };
            img.src = lastState;
        }
    });

    $('#btn-save-mask').click(function() {
        // Save canvas as base64
        const dataUrl = maskCanvas.toDataURL('image/png');
        $('#slot-custom-mask').val(dataUrl);
        $('#mask-editor-overlay').removeClass('active');
        Swal.fire('Guardado', 'La máscara se ha generado correctamente. No olvides guardar la carta para aplicar los cambios.', 'success');
    });

    // --- External Search Logic ---
    $('#btn-external-search').click(function(e) {
        e.preventDefault();
        searchExternalCard('#external-search-input', '#external-search-results', function(card) {
            $('#slot-name').val(card.name);
            $('#slot-image-url').val(card.high_res);
            Swal.fire({
                title: 'Carta Seleccionada',
                text: card.name,
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            });
        });
    });

    $('#external-search-input').keypress(function(e) {
        if (e.which == 13) {
            e.preventDefault();
            $('#btn-external-search').click();
        }
    });

    // Deck Search Listeners
    $(document).on('click', '#btn-deck-external-search', function(e) {
        e.preventDefault();
        searchExternalCard('#deck-external-search-input', '#deck-external-search-results', async function(card) {
            // Immediate add to deck
            const { error } = await _supabase
                .from('deck_cards')
                .insert([{
                    deck_id: currentDeckId,
                    image_url: card.high_res,
                    name: card.name
                }]);

            if (error) {
                Swal.fire('Error', 'No se pudo añadir la carta al deck', 'error');
            } else {
                Swal.fire({
                    title: '¡Añadida!',
                    text: card.name,
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false
                });
                loadDeckCards(currentDeckId);
            }
        });
    });

    $(document).on('keypress', '#deck-external-search-input', function(e) {
        if (e.which == 13) {
            e.preventDefault();
            $('#btn-deck-external-search').click();
        }
    });

    async function searchExternalCard(inputSelector, resultsSelector, onSelectCallback) {
        const query = $(inputSelector).val().trim();

        if (query.length < 3) {
            Swal.fire('Atención', 'Por favor, escribe al menos 3 caracteres para buscar.', 'info');
            return;
        }

        $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">Buscando en todas las bases de datos...</div>');

        try {
            // Concurrent search across all databases (Yu-Gi-Oh and Pokémon in 3 languages)
            const searchPromises = [
                // Yu-Gi-Oh! Name Search
                fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
                // Yu-Gi-Oh! Code/Set Search
                fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : {data:[]}).catch(() => ({data:[]})),
                // Pokémon TCGdex - English
                fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
                // Pokémon TCGdex - Spanish
                fetch(`https://api.tcgdex.net/v2/es/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => []),
                // Pokémon TCGdex - Japanese
                fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : []).catch(() => [])
            ];

            const [ygName, ygCode, pkEn, pkEs, pkJa] = await Promise.all(searchPromises);

            let combinedResults = [];

            // Process Yu-Gi-Oh Results
            const ygoResults = [...(ygName.data || []), ...(ygCode.data || [])];
            ygoResults.forEach(c => {
                if (c.card_images && c.card_images.length > 0) {
                    combinedResults.push({
                        name: c.name,
                        image: c.card_images[0].image_url_small,
                        high_res: c.card_images[0].image_url
                    });
                }
            });

            // Process Pokémon Results
            const pkResults = [...(pkEn || []), ...(pkEs || []), ...(pkJa || [])];
            pkResults.forEach(c => {
                if (c.image) {
                    combinedResults.push({
                        name: c.name,
                        image: `${c.image}/low.webp`,
                        high_res: `${c.image}/high.webp`
                    });
                }
            });

            // Deduplicate by Image URL
            const uniqueResults = [];
            const seenImages = new Set();
            combinedResults.forEach(card => {
                if (!seenImages.has(card.image)) {
                    seenImages.add(card.image);
                    uniqueResults.push(card);
                }
            });

            if (uniqueResults.length === 0) {
                $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">No se encontraron cartas en ninguna base de datos.</div>');
            } else {
                displayExternalResults(uniqueResults.slice(0, 50), resultsSelector, onSelectCallback);
            }

        } catch (err) {
            console.error(err);
            $(resultsSelector).html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #ff4757;">Error al buscar. Inténtalo de nuevo.</div>');
        }
    }

    function displayExternalResults(results, resultsSelector, onSelectCallback) {
        const $container = $(resultsSelector);
        $container.empty();

        if (results.length === 0) {
            $container.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #666;">No se encontraron resultados.</div>');
            return;
        }

        results.forEach(card => {
            const $item = $(`
                <div class="external-card-result" title="${card.name}" style="cursor: pointer; transition: transform 0.2s;">
                    <img src="${card.image}" style="width: 100%; border-radius: 4px; border: 1px solid #333;">
                </div>
            `);

            $item.hover(
                function() { $(this).css('transform', 'scale(1.1)'); },
                function() { $(this).css('transform', 'scale(1)'); }
            );

            $item.click(function() {
                onSelectCallback(card);
            });

            $container.append($item);
        });
    }

    // Canvas Events
    $(maskCanvas).on('mousedown touchstart', function(e) {
        isPainting = true;
        saveMaskHistory();
        draw(e);
    });

    $(window).on('mousemove touchmove', function(e) {
        if (isPainting) draw(e);
    });

    $(window).on('mouseup touchend', function() {
        isPainting = false;
        maskCtx.beginPath();
    });

    function initMaskCanvas() {
        const currentMask = $('#slot-custom-mask').val();

        // Fill black background first
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

        if (currentMask) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
                maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
            };
            img.onerror = function() {
                console.warn("No se pudo cargar la máscara previa en el lienzo (puede ser por CORS).");
            };
            img.src = currentMask;
        }

        maskHistory = [];
    }

    function saveMaskHistory() {
        if (maskHistory.length >= MAX_HISTORY) maskHistory.shift();
        maskHistory.push(maskCanvas.toDataURL());
    }

    function draw(e) {
        if (!isPainting) return;

        const rect = maskCanvas.getBoundingClientRect();
        let x, y;

        if (e.type.includes('touch')) {
            const touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            x = touch.clientX - rect.left;
            y = touch.clientY - rect.top;
            e.preventDefault();
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        // Scale coordinates if canvas display size is different from actual size
        x = x * (maskCanvas.width / rect.width);
        y = y * (maskCanvas.height / rect.height);

        maskCtx.lineWidth = currentBrushSize;
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';
        maskCtx.strokeStyle = currentTool === 'brush' ? 'white' : 'black';

        maskCtx.lineTo(x, y);
        maskCtx.stroke();
        maskCtx.beginPath();
        maskCtx.moveTo(x, y);
    }

    // Deck Management Actions
    $('#btn-create-deck').click(async function(e) {
        e.preventDefault();
        if (!currentUser) return;

        const { data, error } = await _supabase
            .from('decks')
            .insert([{ name: 'Nuevo Deck', user_id: currentUser.id }])
            .select();

        if (error) {
            Swal.fire('Error', 'No se pudo crear el deck', 'error');
        } else {
            loadDecks();
        }
    });

    $('#btn-save-deck-meta').click(async function(e) {
        e.preventDefault();
        const name = $('#input-deck-name').val();
        const is_public = $('#input-deck-public').is(':checked');

        let updateData = { name, is_public };
        let { error } = await _supabase
            .from('decks')
            .update(updateData)
            .eq('id', currentDeckId);

        // Fallback for missing column
        if (error && (error.code === '42703' || (error.message && error.message.includes('is_public')))) {
            console.warn("is_public column missing, retrying update without it.");
            delete updateData.is_public;
            const retry = await _supabase
                .from('decks')
                .update(updateData)
                .eq('id', currentDeckId);
            error = retry.error;
        }

        if (error) {
            Swal.fire('Error', 'No se pudo actualizar el deck: ' + (error.message || ''), 'error');
            console.error(error);
        } else {
            Swal.fire('¡Éxito!', 'Nombre del deck actualizado', 'success');
            loadDecks();
        }
    });

    $('#btn-add-deck-card').click(async function(e) {
        e.preventDefault();
        const { value: url } = await Swal.fire({
            title: 'Añadir imagen al deck',
            input: 'url',
            inputLabel: 'URL de la imagen',
            inputPlaceholder: 'https://...',
            showCancelButton: true
        });

        if (url) {
            const { error } = await _supabase
                .from('deck_cards')
                .insert([{ deck_id: currentDeckId, image_url: url }]);

            if (error) {
                Swal.fire('Error', 'No se pudo añadir la imagen', 'error');
            } else {
                loadDeckCards(currentDeckId);
            }
        }
    });

    // --- Spirit Management ---
    function updateDropZoneUI(zoneId, files) {
        const $zone = $(`#${zoneId}`);
        const $fileName = $zone.find('.file-name');
        if (files && files.length > 0) {
            if (files.length === 1) {
                $fileName.text(files[0].name);
            } else {
                $fileName.text(`${files.length} archivos seleccionados`);
            }
            $zone.find('p').hide();
        } else {
            $fileName.text('');
            $zone.find('p').show();
        }
    }

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    $(document).on('dragover dragenter', '.drop-zone', function(e) {
        handleDrag(e);
        $(this).addClass('drag-over');
        if ($(this).hasClass('file-drop-zone')) $(this).addClass('dragover');
    });

    $(document).on('dragleave dragend drop', '.drop-zone', function(e) {
        handleDrag(e);
        $(this).removeClass('drag-over');
        if ($(this).hasClass('file-drop-zone')) $(this).removeClass('dragover');
    });

    $(document).on('drop', '#drop-zone-spirit', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            droppedGltfFile = null;
            droppedExtraFiles = [];
            processSpiritFiles(files);
        }
    });

    $(document).on('click', '#drop-zone-spirit', function() {
        $('#input-spirit-files').click();
    });

    $(document).on('change', '#input-spirit-files', function() {
        if (this.files.length > 0) {
            droppedGltfFile = null;
            droppedExtraFiles = [];
            processSpiritFiles(this.files);
        }
    });

    $('#btn-open-upload-spirit').click(function() {
        // Reset form
        $('#spirit-modal-title').text('Subir Nuevo Compañero');
        $('#edit-spirit-id').val('');
        $('#input-spirit-name').val('');
        $('#input-spirit-animation').val('orbit');
        $('#input-spirit-particle-asset').val('cerezo.png');
        $('#input-spirit-particle-movement').val('falling');
        $('#input-spirit-scale').val(1.8);
        droppedGltfFile = null;
        droppedExtraFiles = [];
        updateSpiritDropZoneUI(null);
        $('#spirit-upload-modal').addClass('active');
    });

    $('#close-spirit-upload-modal').click(function() {
        $('#spirit-upload-modal').removeClass('active');
    });

    $('#btn-save-spirit').click(async function() {
        const name = $('#input-spirit-name').val();
        const editId = $('#edit-spirit-id').val();
        const gltfFile = droppedGltfFile;
        const extraFiles = droppedExtraFiles;
        const animation = $('#input-spirit-animation').val();
        const particleAsset = $('#input-spirit-particle-asset').val() || 'cerezo.png';
        const particleMovement = $('#input-spirit-particle-movement').val();
        const scale = parseFloat($('#input-spirit-scale').val()) || 1.8;
        const isPublic = $('#input-spirit-public').is(':checked');

        if (!name) {
            Swal.fire('Atención', 'El nombre es obligatorio', 'warning');
            return;
        }

        if (!editId && !gltfFile) {
            Swal.fire('Atención', 'El archivo GLTF es obligatorio para nuevos compañeros', 'warning');
            return;
        }

        Swal.fire({
            title: editId ? 'Actualizando Compañero...' : 'Subiendo Compañero...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            let gltfUrl = null;
            let textureUrl = null;

            if (gltfFile) {
                // 1. Upload into a unique folder to preserve relative paths
                const folderId = Date.now() + '_' + Math.floor(Math.random() * 1000);

                // Upload main GLTF
                const gltfPath = `models/${folderId}/${gltfFile.name}`;
                const { data: gltfData, error: gltfErr } = await _supabase.storage
                    .from('spirits')
                    .upload(gltfPath, gltfFile);

                if (gltfErr) throw gltfErr;
                gltfUrl = _supabase.storage.from('spirits').getPublicUrl(gltfPath).data.publicUrl;

                // 2. Upload extra files (textures, bin, etc.) into the SAME folder
                for (const file of extraFiles) {
                    const path = `models/${folderId}/${file.name}`;
                    const { error: extraErr } = await _supabase.storage
                        .from('spirits')
                        .upload(path, file);
                    if (extraErr) console.warn("Error subiendo archivo extra:", file.name, extraErr);

                    // If it's an image, we might use it as the main texture if needed
                    if (file.type.startsWith('image/')) {
                        textureUrl = _supabase.storage.from('spirits').getPublicUrl(path).data.publicUrl;
                    }
                }
            }

            // 3. Save to DB
            const spiritData = {
                name: name,
                animation_type: animation,
                particle_asset: particleAsset,
                particle_movement_type: particleMovement,
                scale: scale,
                is_public: isPublic
            };

            if (gltfUrl) {
                spiritData.gltf_url = gltfUrl;
                spiritData.texture_url = textureUrl;
            }

            let dbErr;
            if (editId) {
                const { error } = await _supabase
                    .from('spirits')
                    .update(spiritData)
                    .eq('id', editId);
                dbErr = error;
            } else {
                const { error } = await _supabase
                    .from('spirits')
                    .insert([spiritData]);
                dbErr = error;
            }

            if (dbErr) throw dbErr;

            Swal.fire('¡Éxito!', editId ? 'Compañero actualizado correctamente' : 'Compañero subido correctamente', 'success');
            $('#spirit-upload-modal').removeClass('active');
            loadSpirits();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar el compañero: ' + (err.message || ''), 'error');
        }
    });

    // Toggle Public/Private from list (Albums, Decks, Spirits)
    $(document).on('change', '.toggle-public', async function() {
        const id = $(this).data('id');
        const type = $(this).data('type');
        const isChecked = $(this).is(':checked');
        const $label = $(this).parent().next();
        const $card = $(this).closest('.album-card, .spirit-card');

        // Optimistic UI update
        $label.text(isChecked ? 'Público' : 'Privado');
        if ($card.length) {
            $card.css('transition', 'opacity 0.3s ease');
            $card.css('opacity', isChecked ? '1' : '0.7');
        }

        const { error } = await _supabase
            .from(type)
            .update({ is_public: isChecked })
            .eq('id', id);

        if (error) {
            console.error('Error updating visibility:', error);
            if (error.code === '42703' || (error.message && error.message.includes('is_public'))) {
                Swal.fire('Error de Base de Datos', 'La columna "is_public" no existe en la tabla ' + type + '.', 'error');
            } else {
                Swal.fire({
                    title: 'Error',
                    text: 'No se pudo actualizar la visibilidad',
                    icon: 'error',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
            // Revert UI if error
            $(this).prop('checked', !isChecked);
            $label.text(!isChecked ? 'Público' : 'Privado');
            if ($card.length) $card.css('opacity', !isChecked ? '1' : '0.7');
        }
    });
});

function updateSpiritDropZoneUI(files) {
    const $zone = $('#drop-zone-spirit');
    const $fileName = $zone.find('.file-name');
    if (files && files.length > 0) {
        let html = "";
        if (droppedGltfFile) {
            html += `<div style="color: #00d2ff; font-weight: bold; margin-bottom: 5px;"><i class="fas fa-file-code"></i> Principal: ${droppedGltfFile.name}</div>`;
        }
        if (droppedExtraFiles.length > 0) {
            html += `<div style="font-size: 11px; color: #aaa;"><i class="fas fa-paperclip"></i> ${droppedExtraFiles.length} archivos adicionales</div>`;
        }
        $fileName.html(html);
        $zone.find('p').hide();
        $zone.find('i.fa-cloud-upload-alt').hide();
    } else {
        $fileName.text('');
        $zone.find('p').show();
        $zone.find('i.fa-cloud-upload-alt').show();
    }
}

function processSpiritFiles(files) {
    const fileArray = Array.from(files);
    let foundGltf = false;

    fileArray.forEach(file => {
        const name = file.name.toLowerCase();
        if (!foundGltf && (name.endsWith('.gltf') || name.endsWith('.glb'))) {
            droppedGltfFile = file;
            foundGltf = true;
        } else {
            droppedExtraFiles.push(file);
        }
    });

    updateSpiritDropZoneUI(fileArray);
}

function editSpirit(spirit) {
    $('#spirit-modal-title').text('Editar Compañero: ' + spirit.name);
    $('#edit-spirit-id').val(spirit.id);
    $('#input-spirit-name').val(spirit.name);
    $('#input-spirit-animation').val(spirit.animation_type || 'orbit');
    $('#input-spirit-particle-asset').val(spirit.particle_asset || 'cerezo.png');
    $('#input-spirit-particle-movement').val(spirit.particle_movement_type || 'falling');
    $('#input-spirit-scale').val(spirit.scale || 1.8);
    $('#input-spirit-public').prop('checked', spirit.is_public !== false);

    // Reset file selection for edit (optional)
    droppedGltfFile = null;
    droppedExtraFiles = [];
    updateSpiritDropZoneUI(null);

    $('#spirit-upload-modal').addClass('active');
}

// Auth Functions
function checkSession() {
    const session = localStorage.getItem('tcg_session');
    if (session) {
        currentUser = JSON.parse(session);
        showAuthenticatedContent();
    } else {
        showLoginView();
    }
}

async function handleLogin() {
    const username = $('#login-username').val();
    const password = $('#login-password').val();

    if (!username || !password) {
        Swal.fire('Atención', 'Por favor, completa todos los campos', 'warning');
        return;
    }

    const { data, error } = await _supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error');
    } else {
        currentUser = data;
        localStorage.setItem('tcg_session', JSON.stringify(data));
        showAuthenticatedContent();
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('tcg_session');
    location.reload();
}

function showLoginView() {
    $('body').removeClass('public-body');
    $('#login-modal').addClass('active');
    $('#authenticated-content').hide();
}

function initTheme() {
    const savedTheme = localStorage.getItem('tcg_theme') || 'theme-dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    $('body').removeClass('theme-light theme-medium theme-dark').addClass(theme);
    localStorage.setItem('tcg_theme', theme);

    // Update theme icons
    $('.theme-btn, .theme-btn-small').removeClass('active');
    $(`.theme-btn[data-theme="${theme}"], .theme-btn-small[data-theme="${theme}"]`).addClass('active');
}

function showAuthenticatedContent() {
    $('body').addClass('public-body');
    initTheme(); // Ensure theme is applied after showing content
    $('#login-modal').removeClass('active');
    $('#authenticated-content').show();
    $('#welcome-message').text(`Panel de ${currentUser.username}`);

    // Update floating panel
    $('#top-panel').show();
    $('#dropdown-user-name').text(currentUser.username);
    $('#dropdown-user-role').text(currentUser.role || 'Usuario');

    if (currentUser) {
        if (currentUser.role === 'admin') {
            $('#btn-users-panel').show();
            $('#admin-upload-container').show();
        } else {
            $('#btn-users-panel').hide();
            $('#admin-upload-container').hide();
        }
    }

    // Generate public store link
    const publicUrl = `${window.location.origin}${window.location.pathname.replace('admin.html', 'public.html')}?store=${encodeURIComponent(currentUser.store_name)}`;

    const linkHtml = `
        <div class="share-card">
            <div class="share-info">
                <i class="fas fa-link"></i>
                <span>Enlace de tu tienda:</span>
                <input type="text" id="public-link-input" value="${publicUrl}" readonly>
            </div>
            <button onclick="copyPublicLink()" class="btn btn-copy">
                <i class="fas fa-copy"></i> Copiar
            </button>
            <a href="${publicUrl}" target="_blank" class="btn btn-visit">
                <i class="fas fa-external-link-alt"></i> Visitar
            </a>
        </div>
    `;
    $('#store-link-container').html(linkHtml);

    showView('main-dashboard');
}

function copyPublicLink() {
    const copyText = document.getElementById("public-link-input");
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(copyText.value);

    const btn = document.querySelector('.btn-copy');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
    btn.classList.add('btn-success');

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('btn-success');
    }, 2000);
}

// Data Functions
// Deck Functions
async function loadDecks() {
    $('#deck-list').html('<div class="loading">Cargando decks...</div>');

    const { data: decks, error } = await _supabase
        .from('decks')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

    if (error) {
        $('#deck-list').html('<div class="error">Error al cargar decks.</div>');
        return;
    }

    if (decks.length === 0) {
        $('#deck-list').html('<div class="empty">No tienes decks. Crea uno para empezar.</div>');
        return;
    }

    const $tempContainer = $('<div></div>');
    decks.forEach(deck => {
        const isPublic = deck.is_public !== false;
        const publicSwitch = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="switch">
                    <input type="checkbox" class="toggle-public" data-id="${deck.id}" data-type="decks" ${isPublic ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span style="font-size: 10px; color: #aaa;">${isPublic ? 'Público' : 'Privado'}</span>
            </div>
        `;

        const $card = $(`
            <div class="album-card">
                <div class="deck-preview-icon"><i class="fas fa-layer-group fa-3x"></i></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <h3 style="margin:0;">${deck.name}</h3>
                </div>
                <div style="margin-top: 5px;">
                    ${publicSwitch}
                </div>
                <div style="display:flex; gap:10px; margin-top:auto;">
                    <button class="btn btn-edit-deck" data-id="${deck.id}">Editar</button>
                    <button class="btn btn-danger btn-delete-deck" data-id="${deck.id}">Eliminar</button>
                </div>
            </div>
        `);

        $card.find('.btn-edit-deck').click((e) => { e.preventDefault(); editDeck(deck); });
        $card.find('.btn-delete-deck').click((e) => { e.preventDefault(); deleteDeck(deck.id); });

        $tempContainer.append($card);
    });
    $('#deck-list').html($tempContainer.contents());
}

async function editDeck(deck) {
    // Re-fetch para evitar datos obsoletos del cierre
    const { data: latestDeck } = await _supabase
        .from('decks')
        .select('*')
        .eq('id', deck.id)
        .single();

    const target = latestDeck || deck;

    currentDeckId = target.id;
    $('#deck-editor-title').text(`Editando: ${target.name}`);
    $('#input-deck-name').val(target.name);
    $('#input-deck-public').prop('checked', target.is_public !== false);

    showView('deck-editor');
    loadDeckCards(target.id);
}

async function deleteDeck(id) {
    const result = await Swal.fire({
        title: '¿Eliminar deck?',
        text: "Se eliminará el deck y todas sus cartas",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('decks').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar el deck', 'error');
        } else {
            loadDecks();
        }
    }
}

async function loadDeckCards(deckId) {
    $('#deck-card-list').html('<div class="loading">Cargando imágenes...</div>');

    const { data: cards, error } = await _supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('id', { ascending: true });

    if (error) {
        $('#deck-card-list').html('<div class="error">Error al cargar imágenes.</div>');
        return;
    }

    const $tempContainer = $('<div></div>');
    cards.forEach(card => {
        const $cardItem = $(`
            <div class="album-card deck-card-item" style="cursor:pointer; position:relative;">
                <div class="btn-delete-card-top btn-delete-deck-card"><i class="fas fa-times"></i></div>
                <img src="${card.image_url}" style="width:100%; height:150px; object-fit:contain;">
                <div style="font-size: 12px; margin-top: 5px; color: #aaa; text-align: center;">${card.name || 'Sin nombre'}</div>
            </div>
        `);

        $cardItem.click((e) => {
            e.preventDefault();
            if ($(e.target).closest('.btn-delete-deck-card').length) return;
            editDeckCard(card);
        });

        $cardItem.find('.btn-delete-deck-card').click(async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const res = await Swal.fire({
                title: '¿Eliminar carta?',
                text: "¿Estás seguro de que quieres eliminar esta carta del deck?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff4757',
                cancelButtonColor: '#333',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            if (res.isConfirmed) {
                await _supabase.from('deck_cards').delete().eq('id', card.id);
                loadDeckCards(deckId);
            }
        });

        $tempContainer.append($cardItem);
    });
    $('#deck-card-list').html($tempContainer.contents());
}

function editDeckCard(card) {
    editingType = 'deck-card';
    currentDeckCardId = card.id;

    $('#slot-image-url').val(card.image_url || '');
    $('#slot-name').val(card.name || '');
    $('#slot-holo-effect').val(card.holo_effect || '');
    $('#slot-custom-mask').val(card.custom_mask_url || '');

    if (card.holo_effect === 'custom-texture') {
        $('#custom-mask-container').show();
    } else {
        $('#custom-mask-container').hide();
    }

    $('#slot-rarity').val(card.rarity || '');
    $('#slot-expansion').val(card.expansion || '');
    $('#slot-condition').val(card.condition || '');
    $('#slot-quantity').val(card.quantity || 1);
    $('#slot-price').val(card.price || '');

    $('#slot-modal').addClass('active');
}

async function loadAlbums() {
    $('#album-list').html('<div class="loading">Cargando álbumes...</div>');

    const { data: albums, error } = await _supabase
        .from('albums')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });

    if (error) {
        $('#album-list').html('<div class="error">Error al cargar álbumes.</div>');
        return;
    }

    if (albums.length === 0) {
        $('#album-list').html('<div class="empty">No tienes álbumes. Crea uno para empezar.</div>');
        return;
    }

    const $tempContainer = $('<div></div>');
    albums.forEach(album => {
        const cover = album.cover_image_url || 'https://via.placeholder.com/300x150?text=Sin+Portada';
        const isPublic = album.is_public !== false;
        const publicSwitch = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <label class="switch">
                    <input type="checkbox" class="toggle-public" data-id="${album.id}" data-type="albums" ${isPublic ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span style="font-size: 10px; color: #aaa;">${isPublic ? 'Público' : 'Privado'}</span>
            </div>
        `;

        const $card = $(`
            <div class="album-card">
                <img src="${cover}" alt="${album.title}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <h3 style="margin:0;">${album.title}</h3>
                </div>
                <div style="margin-top: 5px;">
                    ${publicSwitch}
                </div>
                <div style="display:flex; gap:10px; margin-top:auto;">
                    <button class="btn btn-edit-album" data-id="${album.id}">Editar</button>
                    <button class="btn btn-danger btn-delete-album" data-id="${album.id}">Eliminar</button>
                </div>
            </div>
        `);

        $card.find('.btn-edit-album').click((e) => { e.preventDefault(); editAlbum(album); });
        $card.find('.btn-delete-album').click((e) => { e.preventDefault(); deleteAlbum(album.id); });

        $tempContainer.append($card);
    });
    $('#album-list').html($tempContainer.contents());
}

function showView(view) {
    $('.admin-section').hide().removeClass('active');
    $(`#view-${view}`).show().addClass('active');
}

async function editAlbum(album) {
    // Re-fetch para evitar datos obsoletos del cierre
    const { data: latestAlbum } = await _supabase
        .from('albums')
        .select('*')
        .eq('id', album.id)
        .single();

    const target = latestAlbum || album;

    currentAlbumId = target.id;
    $('#editor-title').text(`Editando: ${target.title}`);
    $('#input-album-title').val(target.title);
    $('#input-album-cover').val(target.cover_image_url || '');
    $('#input-album-back').val(target.back_image_url || '');
    $('#input-album-cover-color').val(target.cover_color || '#1a1a1a');
    $('#input-album-back-color').val(target.back_color || '#1a1a1a');
    $('#input-album-public').prop('checked', target.is_public !== false);
    
    showView('editor');
    loadAlbumPages(target.id);
}

async function deleteAlbum(id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Se eliminará el álbum y todo su contenido permanentemente",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('albums').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar el álbum', 'error');
        } else {
            Swal.fire('Eliminado', 'El álbum ha sido borrado', 'success');
            loadAlbums();
        }
    }
}

async function loadAlbumPages(albumId, isInitial = true) {
    if (isInitial) {
        $('#page-list').html('<div class="loading">Cargando páginas...</div>');
    }

    const { data: pages, error } = await _supabase
        .from('pages')
        .select('*')
        .eq('album_id', albumId)
        .order('page_index', { ascending: true });

    if (error) {
        $('#page-list').html('<div class="error">Error al cargar páginas.</div>');
        return;
    }

    // Obtener todos los slots de todas las páginas en una sola consulta
    const pageIds = pages.map(p => p.id);
    let allSlots = [];
    if (pageIds.length > 0) {
        const { data: slotsData } = await _supabase
            .from('card_slots')
            .select('*')
            .in('page_id', pageIds);
        allSlots = slotsData || [];
    }

    const $tempContainer = $('<div></div>');
    
    for (const page of pages) {
        const $pageItem = $(`
            <div class="admin-page-item" data-id="${page.id}">
                <h3>
                    Página ${page.page_index + 1}
                    <button class="btn btn-danger btn-sm btn-delete-page" data-id="${page.id}">Eliminar Página</button>
                </h3>
                <div class="grid-container admin-grid-preview">
                    <!-- 9 Slots -->
                </div>
            </div>
        `);

        $pageItem.find('.btn-delete-page').click((e) => {
            e.preventDefault();
            deletePage(page.id);
        });

        const $grid = $pageItem.find('.grid-container');
        const pageSlots = allSlots.filter(s => s.page_id === page.id);

        for (let i = 0; i < 9; i++) {
            const slotData = pageSlots.find(s => s.slot_index === i);
            const $slot = $(`<div class="card-slot" data-index="${i}"></div>`);
            if (slotData && slotData.image_url) {
                $slot.append(`<img src="${slotData.image_url}" class="tcg-card">`);

                // Add Delete Button (Jules)
                const $btnDelete = $('<div class="btn-delete-card-top"><i class="fas fa-times"></i></div>');
                $btnDelete.click(async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const res = await Swal.fire({
                        title: '¿Eliminar carta?',
                        text: "¿Estás seguro de que quieres quitar esta carta del álbum?",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#ff4757',
                        cancelButtonColor: '#333',
                        confirmButtonText: 'Sí, eliminar',
                        cancelButtonText: 'Cancelar'
                    });
                    if (res.isConfirmed) {
                        const { error } = await _supabase
                            .from('card_slots')
                            .delete()
                            .eq('page_id', page.id)
                            .eq('slot_index', i);

                        if (error) {
                            Swal.fire('Error', 'No se pudo eliminar la carta', 'error');
                        } else {
                            loadAlbumPages(albumId, false);
                        }
                    }
                });
                $slot.append($btnDelete);
            } else {
                $slot.append('<div style="color:#444; font-size:10px; text-align:center; padding-top:10px;">Vacío</div>');
            }
            $grid.append($slot);
        }

        $tempContainer.append($pageItem);
    }

    $('#page-list').html($tempContainer.contents());
}

async function deletePage(id) {
    const result = await Swal.fire({
        title: '¿Eliminar página?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        cancelButtonColor: '#333',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        const { error } = await _supabase.from('pages').delete().eq('id', id);
        if (error) {
            Swal.fire('Error', 'No se pudo eliminar la página', 'error');
        } else {
            Swal.fire('Eliminada', 'La página ha sido borrada', 'success');
            loadAlbumPages(currentAlbumId, false);
        }
    }
}

async function loadSpirits() {
    $('#spirits-grid').html('<div class="loading">Cargando compañeros...</div>');

    // Fetch spirits and user's selection
    const [spiritsRes, userRes] = await Promise.all([
        _supabase.from('spirits').select('*').order('name', { ascending: true }),
        _supabase.from('usuarios').select('selected_spirit_id').eq('id', currentUser.id).single()
    ]);

    if (spiritsRes.error || !spiritsRes.data) {
        $('#spirits-grid').html('<div class="error">Error al cargar compañeros.</div>');
        return;
    }

    const spirits = spiritsRes.data;
    const selectedId = userRes.data ? userRes.data.selected_spirit_id : null;

    if (spirits.length === 0) {
        $('#spirits-grid').html('<div class="empty">No hay compañeros disponibles.</div>');
        return;
    }

    const $grid = $('#spirits-grid');
    $grid.empty();

    spirits.forEach(spirit => {
        const isSelected = spirit.id == selectedId;
        const isAsh = spirit.gltf_url && spirit.gltf_url.toLowerCase().includes('ash.gltf');
        const isPublic = spirit.is_public !== false;

        const $card = $(`
            <div class="spirit-card ${isSelected ? 'selected' : ''}">
                <div class="badge-selected">Seleccionado</div>
                <model-viewer
                    src="${spirit.gltf_url}"
                    loading="lazy"
                    camera-controls
                    shadow-intensity="1"
                    environment-image="neutral"
                    exposure="1.2">
                </model-viewer>
                <h3>${spirit.name}</h3>
                <div style="margin-bottom: 15px; width: 100%;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <label class="switch">
                            <input type="checkbox" class="toggle-public" data-id="${spirit.id}" data-type="spirits" ${isPublic ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span style="font-size: 10px; color: #aaa;">${isPublic ? 'Público' : 'Privado'}</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                    <button class="btn btn-select ${isSelected ? 'btn-success' : ''}" ${isSelected ? 'disabled' : ''}>
                        ${isSelected ? '<i class="fas fa-check-circle"></i> Seleccionado' : 'Seleccionar'}
                    </button>
                    ${currentUser.role === 'admin' ? `
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-secondary btn-edit-spirit" style="flex: 1;"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn btn-danger btn-delete-spirit" data-id="${spirit.id}" style="flex: 1;"><i class="fas fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `);

        $card.find('.btn-delete-spirit').click(function() {
            const id = $(this).data('id');
            deleteSpirit(id, spirit.gltf_url);
        });

        $card.find('.btn-edit-spirit').click(function() {
            window.editSpirit(spirit);
        });

        $card.find('.btn-select').click(async function() {
            const { error } = await _supabase
                .from('usuarios')
                .update({ selected_spirit_id: spirit.id })
                .eq('id', currentUser.id);

            if (error) {
                Swal.fire('Error', 'No se pudo seleccionar el compañero', 'error');
            } else {
                Swal.fire({
                    title: '¡Compañero Seleccionado!',
                    text: `${spirit.name} aparecerá en tus pantallas de carga.`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                loadSpirits();
            }
        });

        $grid.append($card);
    });
}

async function deleteSpirit(id, gltfUrl) {
    const result = await Swal.fire({
        title: '¿Eliminar Compañero?',
        text: "Se eliminará el registro y todos los archivos asociados en el servidor.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff4757',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        Swal.fire({
            title: 'Eliminando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            // 1. Delete from Storage (Cleanup)
            // Extract folder path: models/{folderId}/filename.gltf
            if (gltfUrl && gltfUrl.includes('/models/')) {
                const parts = gltfUrl.split('/models/');
                if (parts.length > 1) {
                    const folderPath = parts[1].split('/')[0];
                    const fullFolderPath = `models/${folderPath}`;

                    // List files in folder to delete them
                    const { data: files, error: listErr } = await _supabase.storage
                        .from('spirits')
                        .list(fullFolderPath);

                    if (!listErr && files) {
                        const filesToRemove = files.map(f => `${fullFolderPath}/${f.name}`);
                        const { error: delErr } = await _supabase.storage
                            .from('spirits')
                            .remove(filesToRemove);
                        if (delErr) console.warn("Error eliminando archivos de storage:", delErr);
                    }
                }
            }

            // 2. Delete from DB
            const { error: dbErr } = await _supabase
                .from('spirits')
                .delete()
                .eq('id', id);

            if (dbErr) throw dbErr;

            Swal.fire('¡Eliminado!', 'El compañero ha sido borrado correctamente.', 'success');
            loadSpirits();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo eliminar el compañero: ' + (err.message || ''), 'error');
        }
    }
}

async function loadSlotData(pageId, slotIndex) {
    editingType = 'slot';
    const { data, error } = await _supabase
        .from('card_slots')
        .select('*')
        .eq('page_id', pageId)
        .eq('slot_index', slotIndex)
        .single();

    $('#slot-image-url').val('');
    $('#slot-name').val('');
    $('#external-search-input').val('');
    $('#external-search-results').empty();
    $('#slot-holo-effect').val('');
    $('#slot-custom-mask').val('');
    $('#slot-rarity').val('');
    $('#slot-expansion').val('');
    $('#slot-condition').val('');
    $('#slot-quantity').val('');
    $('#slot-price').val('');

    if (data) {
        $('#slot-image-url').val(data.image_url || '');
        $('#slot-name').val(data.name || '');
        $('#slot-holo-effect').val(data.holo_effect || '');
        $('#slot-custom-mask').val(data.custom_mask_url || '');

        if (data.holo_effect === 'custom-texture') {
            $('#custom-mask-container').show();
        } else {
            $('#custom-mask-container').hide();
        }

        $('#slot-rarity').val(data.rarity || '');
        $('#slot-expansion').val(data.expansion || '');
        $('#slot-condition').val(data.condition || '');
        $('#slot-quantity').val(data.quantity || '');
        $('#slot-price').val(data.price || '');
    }

    $('#slot-modal').addClass('active');
}
