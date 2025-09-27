"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import defaultOverlay from "../../assets/a.png";

export default function CameraEffectApp() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);

    const [status, setStatus] = useState("Aguardando câmera...");
    const [lastBlobUrl, setLastBlobUrl] = useState(null);
    const [overlayLoaded, setOverlayLoaded] = useState(false);
    const [overlaySelected, setOverlaySelected] = useState(defaultOverlay);
    const [currentLut, setCurrentLut] = useState(null);
    const [effectType, setEffectType] = useState('default');

    const cubeOverlayUrl = "/overlays/5.cube";

    // --- Função para carregar LUT .cube ---
    const loadCubeLut = useCallback(async (url) => {
        setStatus(`Carregando LUT de: ${url}...`);
        try {
            const res = await fetch(url);
            const text = await res.text();
            const lines = text.split("\n").filter(l => !l.startsWith("#") && l.trim() !== "");

            const sizeLine = lines.find(l => l.startsWith('LUT_3D_SIZE'));
            const size = sizeLine ? parseInt(sizeLine.split(/\s+/)[1]) : 32;
            const expectedLines = size * size * size;

            let dataStartIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].toUpperCase().startsWith('TITLE') &&
                    !lines[i].toUpperCase().startsWith('DOMAIN_MIN') &&
                    !lines[i].toUpperCase().startsWith('DOMAIN_MAX') &&
                    !lines[i].toUpperCase().startsWith('LUT_3D_SIZE')) {
                    dataStartIndex = i;
                    break;
                }
            }

            const lutData = lines.slice(dataStartIndex).map(l => l.trim().split(/\s+/).map(Number));
            if (lutData.length !== expectedLines) {
                console.warn(`Esperado ${expectedLines} linhas, encontrado ${lutData.length}.`);
            }

            setStatus(`LUT ${size}x${size}x${size} carregado!`);
            return { data: lutData, size };
        } catch (error) {
            console.error("Erro ao carregar LUT:", error);
            setStatus("Erro ao carregar LUT.");
            return null;
        }
    }, []);

    // --- Aplica LUT aos pixels ---
    const applyLutToImageData = useCallback((imageData, lut) => {
        if (!lut || !lut.data || !lut.size) return;

        const data = imageData.data;
        const size = lut.size;
        const factor = (size - 1) / 255;

        for (let i = 0; i < data.length; i += 4) {
            const r_idx = Math.round(data[i] * factor);     // R (Vermelho)
            const g_idx = Math.round(data[i + 1] * factor); // G (Verde)
            const b_idx = Math.round(data[i + 2] * factor); // B (Azul)

            // 🛑 MUDAR ESTA LINHA: De RGB para BGR
            // const index = r_idx * size * size + g_idx * size + b_idx; // Ordem RGB (Original)
            const index = b_idx * size * size + g_idx * size + r_idx; // Ordem BGR (Tentar esta)

            const lutEntry = lut.data[index];

            // ... (código restante)


            if (lutEntry) {
                data[i] = Math.round(lutEntry[0] * 255);
                data[i + 1] = Math.round(lutEntry[1] * 255);
                data[i + 2] = Math.round(lutEntry[2] * 255);
            }
        }
        return imageData;
    }, []);

    // --- Preload overlay ---
    useEffect(() => {
        if (effectType !== 'overlay' && effectType !== 'default') {
            overlayRef.current = null;
            setOverlayLoaded(false);
            return;
        }

        const img = new Image();
        const src = typeof overlaySelected === "string" ? overlaySelected : overlaySelected.src;

        if (src) {
            img.src = src;
            img.onload = () => {
                overlayRef.current = img;
                setOverlayLoaded(true);
            };
        } else {
            overlayRef.current = null;
            setOverlayLoaded(false);
        }
    }, [overlaySelected, effectType]);

    // --- Inicia câmera ---
    useEffect(() => {
        let mounted = true;

        async function startCamera() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setStatus("Navegador não suporta câmera.");
                return;
            }

            try {
                setStatus("Solicitando permissão da câmera...");
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
                if (!mounted) return;

                const video = videoRef.current;
                video.srcObject = stream;
                await video.play();
                setStatus("Câmera ativa");
            } catch (err) {
                console.error(err);
                setStatus("Erro ao acessar câmera: " + (err.message || err));
            }
        }

        startCamera();

        return () => {
            mounted = false;
            const video = videoRef.current;
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // --- Seleciona efeito ---
    const selectEffect = useCallback(async (type) => {
        setEffectType(type);
        setCurrentLut(null);
        setOverlaySelected(null);

        if (type === 'default' || type === 'overlay') {
            setOverlaySelected(defaultOverlay);
            setStatus("Efeito 'Default' selecionado.");
        } else if (type === 'cube') {
            const lut = await loadCubeLut(cubeOverlayUrl);
            if (lut) {
                setCurrentLut(lut);
                setStatus("LUT carregado!");
            } else {
                setStatus("Falha ao carregar LUT.");
                setEffectType('none');
            }
        } else {
            setStatus("Nenhum efeito selecionado.");
        }
    }, [loadCubeLut]);

    // --- Loop de renderização em tempo real ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const video = videoRef.current;

        if (!canvas || !video) return;

        const W = 1080;
        const H = 1920;
        canvas.width = W;
        canvas.height = H;

        let animationFrameId;

        const renderFrame = () => {
            if (video.readyState >= 2) {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const scale = Math.max(W / vw, H / vh);
                const sw = W / scale;
                const sh = H / scale;
                const sx = (vw - sw) / 2;
                const sy = (vh - sh) / 2;

                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);

                if (currentLut) {
                    let imageData = ctx.getImageData(0, 0, W, H);
                    imageData = applyLutToImageData(imageData, currentLut);
                    ctx.putImageData(imageData, 0, 0);
                }

                const overlay = overlayRef.current;
                if (overlay && (effectType === 'default' || effectType === 'overlay')) {
                    const ow = overlay.width;
                    const oh = overlay.height;
                    const scaleOverlay = Math.min(W / ow, H / oh);
                    const owScaled = ow * scaleOverlay;
                    const ohScaled = oh * scaleOverlay;
                    const ox = (W - owScaled) / 2;
                    const oy = (H - ohScaled) / 2;
                    ctx.drawImage(overlay, ox, oy, owScaled, ohScaled);
                }
            }
            animationFrameId = requestAnimationFrame(renderFrame);
        };

        renderFrame();
        return () => cancelAnimationFrame(animationFrameId);
    }, [currentLut, effectType, overlayLoaded]);

    // --- Captura ---
    // --- Captura mantendo qualidade real ---
    const captureAndDownload = async () => {
        setStatus("Gerando foto...");

        try {
            const video = videoRef.current;
            const canvas = document.createElement("canvas"); // canvas temporário
            const W = video.videoWidth;
            const H = video.videoHeight;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext("2d");

            // Desenhar vídeo
            ctx.drawImage(video, 0, 0, W, H);

            // Desenhar overlay se estiver selecionado
            const overlay = overlayRef.current;
            if (overlay && (effectType === "default" || effectType === "overlay")) {
                const ow = overlay.width;
                const oh = overlay.height;
                const scaleOverlay = Math.min(W / ow, H / oh);
                const owScaled = ow * scaleOverlay;
                const ohScaled = oh * scaleOverlay;
                const ox = (W - owScaled) / 2;
                const oy = (H - ohScaled) / 2;
                ctx.drawImage(overlay, ox, oy, owScaled, ohScaled);
            }

            // Aplicar LUT apenas na captura
            if (currentLut) {
                let imageData = ctx.getImageData(0, 0, W, H);
                imageData = applyLutToImageData(imageData, currentLut);
                ctx.putImageData(imageData, 0, 0);
            }

            // Salvar foto
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                setLastBlobUrl(url);
                const a = document.createElement("a");
                const ts = new Date().toISOString().replace(/[:.]/g, "-");
                a.href = url;
                a.download = `photo-${ts}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setStatus("Foto salva!");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }, "image/png");
        } catch (err) {
            console.error(err);
            setStatus("Erro ao capturar: " + (err.message || err));
        }
    };


    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    zIndex: 1
                }}
            />
            <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />

            <div style={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                zIndex: 3,
            }}>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => selectEffect('default')} style={{ border: effectType === 'default' ? '2px solid yellow' : '1px solid #ddd' }}>Default</button>
                    <button onClick={() => selectEffect('cube')} style={{ border: effectType === 'cube' ? '2px solid yellow' : '1px solid #ddd' }}>Cube (LUT)</button>
                    <button onClick={() => selectEffect('none')} style={{ border: effectType === 'none' ? '2px solid yellow' : '1px solid #ddd' }}>Nenhum</button>
                </div>

                <button onClick={captureAndDownload} style={{ padding: "12px 20px", borderRadius: 50, background: "#4f46e5", color: "#fff", border: "none", fontSize: 16 }}>
                    📸 Capturar
                </button>

                {lastBlobUrl && (
                    <button onClick={() => window.open(lastBlobUrl, "_blank")} style={{ padding: "12px 20px", borderRadius: 50, background: "#fff", border: "1px solid #ddd", fontSize: 16 }}>
                        📂 Ver última
                    </button>
                )}
            </div>

            <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", fontSize: 14, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "4px 10px", borderRadius: 8, zIndex: 3 }}>
                {status}
            </div>
        </div>
    );
}
