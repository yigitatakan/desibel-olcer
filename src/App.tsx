import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, AlertTriangle, Info } from 'lucide-react';

function App() {
  const [isListening, setIsListening] = useState(false);
  const [decibels, setDecibels] = useState(0);
  const [peak, setPeak] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [spectrum, setSpectrum] = useState<Uint8Array | null>(null);
  const [hue, setHue] = useState(240); // Başlangıç rengi (mor)
  
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Ses seviyesine göre rengi değiştir
    if (isListening && decibels > 0) {
      // Desibele göre renk değişimi: mor -> mavi -> yeşil -> sarı -> kırmızı
      const newHue = 270 - (decibels * 2); // 270 (mor) başlangıç, yüksek ses daha kırmızıya doğru gider
      setHue(Math.max(0, Math.min(newHue, 270))); // 0-270 arası sınırla
    }
  }, [isListening, decibels]);

  // Canvas çizim efekti
  useEffect(() => {
    if (!canvasRef.current || !isListening || !spectrum) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Boyutu ayarla
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Arka planı temizle
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Merkez noktası
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // 90 derece sola döndürmek için
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-Math.PI / 2); // -90 derece (sola döndür)
    
    // Trap Nation tarzı gradyan arka plan
    const gradient = ctx.createLinearGradient(-centerY, -centerX, centerY, centerX);
    gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.8)`);
    gradient.addColorStop(0.5, `hsla(${hue + 30}, 100%, 50%, 0.6)`);
    gradient.addColorStop(1, `hsla(${hue + 60}, 100%, 40%, 0.4)`);
    
    // Dış çember çiz (ana çemberi göstermek için)
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(centerX, centerY) * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    
    // Trap Nation benzeri logo efekti
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(centerX, centerY) * 0.7, 0, Math.PI * 2);
    ctx.clip();
    
    // "dB" metni - döndürmeyi telafi et
    ctx.rotate(Math.PI / 2); // Metni düz göstermek için ters döndür
    ctx.fillStyle = "white";
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${decibels} dB`, 0, 0);
    
    // Desibel tipi
    ctx.font = '14px Arial';
    ctx.fillText(getDecibelDescription(decibels), 0, 25);
    ctx.restore(); // İç save/restore
    
    // Spektrum dalga çizimi - Trap Nation tarzı - 90 derece döndürülmüş
    const bars = spectrum.length;
    const barWidth = (Math.PI * 2) / bars;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    for (let i = 0; i < bars; i++) {
      if (i % 2 !== 0) continue; // Atlayarak çiz (daha estetik)
      
      const value = spectrum[i] || 0;
      const normalizedValue = value / 255;
      
      // Ses dalgasının boyutunu hesapla
      const barHeight = normalizedValue * (radius * 0.5) + (radius * 0.1); // Minimum boyut + dinamik boyut
      const outerRadius = radius + barHeight;
      
      // Açı hesaplama - başlangıç açısını 90 derece kaydır
      const startAngle = i * barWidth;
      const endAngle = startAngle + barWidth;
      
      // Renk hesaplama - spektrumun her bir parçası için farklı renk tonu
      const barHue = (hue + (i / bars) * 60) % 360;
      
      // Bar çizimi
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, startAngle, endAngle);
      ctx.arc(0, 0, radius, endAngle, startAngle, true);
      ctx.closePath();
      
      // Gradyan dolgu
      const barGradient = ctx.createRadialGradient(
        0, 0, radius,
        0, 0, outerRadius
      );
      barGradient.addColorStop(0, `hsla(${barHue}, 100%, 50%, 0.7)`);
      barGradient.addColorStop(1, `hsla(${barHue + 30}, 100%, 70%, 0.9)`);
      
      ctx.fillStyle = barGradient;
      ctx.fill();
      
      // Parlak kenar efekti
      ctx.strokeStyle = `hsla(${barHue + 30}, 100%, 75%, 0.8)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Parıltı efekti
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      0, 0, radius * 0.8,
      0, 0, radius * 1.2
    );
    glow.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.1)`);
    glow.addColorStop(0.5, `hsla(${hue}, 100%, 60%, 0.05)`);
    glow.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
    
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    ctx.restore(); // Ana save/restore - döndürmeyi sıfırla
    
    // Parçacık efekti - döndürülmüş değil, ekranın her yerine dağılsın
    if (decibels > 30) {
      const particleCount = Math.floor(decibels / 5);
      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * 1.2 + Math.random() * 50;
        const size = Math.random() * 3 + 1;
        const particleHue = (hue + Math.random() * 60) % 360;
        
        const px = centerX + Math.cos(angle) * distance;
        const py = centerY + Math.sin(angle) * distance;
        
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particleHue}, 100%, 70%, ${Math.random() * 0.5 + 0.2})`;
        ctx.fill();
      }
    }
  }, [spectrum, isListening, hue, decibels]);

  const calculateDecibels = (dataArray: Uint8Array): number => {
    const rms = Math.sqrt(
      dataArray.reduce((sum, val) => {
        const amplifiedVal = val < 128 ? val * 1.5 : val;
        return sum + (amplifiedVal * amplifiedVal);
      }, 0) / dataArray.length
    );

    const refLevel = 0.00001; 
    const amplitude = rms / 255;
    const pressure = Math.pow(amplitude, 1.5) * 2;
    const db = 20 * Math.log10(Math.max(pressure, refLevel) / refLevel);
    
    const calibrationOffset = -20;
    const minDb = 10; 
    
    return Math.max(minDb, Math.round(db + calibrationOffset));
  };

  const startListening = async () => {
    setIsInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      mediaStreamRef.current = stream;
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192; 
      analyser.smoothingTimeConstant = 0.2; 
      analyser.minDecibels = -90; 
      analyser.maxDecibels = -10; 
      source.connect(analyser);
      analyserRef.current = analyser;

      const frequencyDataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateDecibels = () => {
        analyser.getByteFrequencyData(frequencyDataArray);
        const db = calculateDecibels(frequencyDataArray);
        setDecibels(db);
        setPeak(prev => Math.max(prev, db));
        setSpectrum(new Uint8Array(frequencyDataArray)); // Spektrum verilerini güncelle
        animationRef.current = requestAnimationFrame(updateDecibels);
      };

      updateDecibels();
      setIsListening(true);
    } catch (error: unknown) {
      console.error('Error accessing microphone:', error);
      
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        for (const prop in error) {
          try {
            if (Object.prototype.hasOwnProperty.call(error, prop)) {
              const key = prop as keyof Error;
              console.error(`Error property ${prop}:`, error[key]);
            }
          } catch (e) {
            console.error(`Error accessing property ${prop}`);
          }
        }
      }
      
      if (error instanceof DOMException) {
        console.error('DOMException Code:', error.code);
        console.error('DOMException Name:', error.name);
        console.error('DOMException Message:', error.message);
      }
      
      console.info('Browser supports AudioContext:', typeof AudioContext !== 'undefined');
      console.info('Browser supports getUserMedia:', navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
      
      let errorMessage = 'Mikrofonunuza erişim izni gerekiyor.';
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Mikrofon izni reddedildi. Lütfen tarayıcı adres çubuğunun solundaki kilit simgesine tıklayarak "Site Ayarları"ndan mikrofon erişimine izin verin.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Mikrofon bulunamadı. Lütfen cihazınıza bir mikrofon bağlı olduğundan emin olun.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Mikrofonunuza erişilemiyor. Başka bir uygulama tarafından kullanılıyor olabilir.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Belirtilen mikrofon gereksinimleri karşılanamıyor.';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Mikrofon erişimi işlemi iptal edildi.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Güvenlik kısıtlamaları nedeniyle mikrofona erişilemiyor.';
        } else {
          errorMessage = `Mikrofon erişim hatası: ${error.name} - ${error.message || 'Detay yok'}`;
        }
      } else if (error instanceof Error) {
        errorMessage = `Mikrofon erişim hatası: ${error.message || error.toString()}`;
      } else {
        errorMessage = 'Bilinmeyen bir mikrofon erişim hatası oluştu. Tarayıcınızın Web Audio API\'yi desteklediğinden emin olun.';
      }
      
      alert(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopListening = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
    setPeak(0);
    setSpectrum(null);
  };

  const getDecibelDescription = (level: number) => {
    if (level < 20) return 'Çok Sessiz';
    if (level < 30) return 'Sessiz';
    if (level < 40) return 'Sakin';
    if (level < 50) return 'Normal';
    if (level < 60) return 'Orta';
    if (level < 70) return 'Gürültülü';
    if (level < 80) return 'Çok Gürültülü';
    return 'Tehlikeli';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-800 to-black text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        {/* Arka plan parıltı efekti */}
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-700 via-transparent to-transparent transition-opacity duration-700 ${isListening ? 'opacity-50' : 'opacity-0'}`} 
             style={{ 
               transform: `scale(${1 + decibels/200})`,
               filter: `hue-rotate(${(hue - 240)}deg)` // Rengi dinamik olarak değiştir
             }} />
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="text-center mb-12">
          <h1 className={`text-5xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent transition-all duration-700 ${isListening ? 'scale-105' : ''}`}
              style={{ filter: `hue-rotate(${(hue - 240)}deg)` }}>
            Desibel Ölçer
          </h1>
          <p className="text-gray-400 text-lg">Kalibre Edilmiş Ses Seviyesi Ölçümü</p>
        </header>

        <div className="max-w-3xl mx-auto bg-gray-800/30 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-gray-700/50 transition-all duration-500 hover:shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-80 h-80 mb-8">
              {/* Trap Nation tarzı spektrum görseli */}
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full rounded-full z-10"
                style={{ filter: `drop-shadow(0 0 8px hsla(${hue}, 100%, 60%, 0.7))` }}
              />
              
              {/* Eski gösterge arayüzü - ihtiyaç olursa kaldırabilirsiniz */}
              <div className="absolute inset-0 rounded-full border-4 border-gray-700/40 flex items-center justify-center flex-col transition-all duration-300 z-0 opacity-0">
                <div className="text-6xl font-bold transition-all duration-300">
                  {decibels}
                </div>
                <div className="text-2xl mt-1">dB</div>
                <div className="text-sm mt-2 text-gray-500 font-medium transition-colors duration-300">
                  {getDecibelDescription(decibels)}
                </div>
              </div>
            </div>

            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isInitializing}
              className="px-8 py-4 rounded-full text-lg font-semibold transition-all duration-500 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r shadow-lg"
              style={{ 
                background: `linear-gradient(90deg, hsl(${hue}, 100%, 60%), hsl(${hue + 60}, 100%, 70%))`,
                boxShadow: `0 10px 15px -3px hsla(${hue}, 100%, 50%, 0.3)` 
              }}
            >
              {isInitializing ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2">
                    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  Başlatılıyor...
                </div>
              ) : isListening ? (
                <div className="flex items-center">
                  <VolumeX className="mr-2" />
                  Durdur
                </div>
              ) : (
                <div className="flex items-center">
                  <Volume2 className="mr-2" />
                  Ölçüme Başla
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-700/30 backdrop-blur rounded-2xl p-6 border border-gray-600/30 transition-all duration-300 hover:bg-gray-700/40 hover:shadow-lg">
              <div className="flex items-center mb-4">
                <AlertTriangle className="text-amber-500 mr-2" />
                <h3 className="text-xl font-semibold">En Yüksek Değer</h3>
              </div>
              <div className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent"
                   style={{ filter: `hue-rotate(${(hue - 240)}deg)` }}>
                {peak} dB
              </div>
              <div className="text-sm text-gray-400 mt-2 font-medium">{getDecibelDescription(peak)}</div>
            </div>

            <div className="bg-gray-700/30 backdrop-blur rounded-2xl p-6 border border-gray-600/30 transition-all duration-300 hover:bg-gray-700/40 hover:shadow-lg">
              <div className="flex items-center mb-4">
                <Info className="text-blue-500 mr-2" />
                <h3 className="text-xl font-semibold">Desibel Referansları</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1.5">
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" 
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.3}deg)` }}></div>
                  10-20 dB: Yaprak hışırtısı
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.3}deg)` }}></div>
                  20-30 dB: Fısıltı, sessiz oda
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.3}deg)` }}></div>
                  30-40 dB: Sessiz kütüphane
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.5}deg)` }}></div>
                  40-50 dB: Sakin ev ortamı
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.5}deg)` }}></div>
                  50-60 dB: Normal konuşma
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.7}deg)` }}></div>
                  60-70 dB: Gürültülü restoran
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.7}deg)` }}></div>
                  70-90 dB: Şehir trafiği, fabrika
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"
                       style={{ filter: `hue-rotate(${(hue - 240) * 0.7}deg)` }}></div>
                  90+ dB: Konser, motor sesi (tehlikeli)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;