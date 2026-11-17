type ProductArtworkProps = {
  category: string;
  imageUrl?: string | null;
  name: string;
  hero?: boolean;
};

const categoryClass = (category: string) => category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export default function ProductArtwork({ category, imageUrl, name, hero = false }: ProductArtworkProps) {
  return (
    <div className={`product-artwork art-${categoryClass(category)}${hero ? ' product-artwork-hero' : ''}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} loading={hero ? 'eager' : 'lazy'} />
      ) : (
        <>
          <span className="art-sun" aria-hidden="true" />
          <span className="art-ground" aria-hidden="true" />
          <svg viewBox="0 0 520 420" fill="none" role="img" aria-label={`${category} illustration`} aria-hidden="true">
            <ellipse cx="263" cy="344" rx="121" ry="21" fill="#283C31" fillOpacity=".14" />
            {category.toLowerCase().includes('elect') ? (
              <g className="art-object">
                <path d="M157 235v-34a105 105 0 0 1 210 0v34" stroke="#314B3D" strokeWidth="28" strokeLinecap="round" />
                <rect x="139" y="222" width="63" height="100" rx="24" fill="#3F604C" />
                <rect x="322" y="222" width="63" height="100" rx="24" fill="#3F604C" />
                <rect x="151" y="239" width="39" height="66" rx="17" fill="#D8EF82" />
                <rect x="334" y="239" width="39" height="66" rx="17" fill="#D8EF82" />
                <path d="M211 117c16-10 30-15 50-15 18 0 33 5 48 15" stroke="#F9F8EF" strokeWidth="5" strokeLinecap="round" strokeOpacity=".7" />
              </g>
            ) : category.toLowerCase().includes('fit') ? (
              <g className="art-object">
                <path d="M206 186v-22a54 54 0 0 1 108 0v22" stroke="#314B3D" strokeWidth="17" strokeLinecap="round" />
                <path d="M183 188c0-13 10-23 23-23h107c13 0 23 10 23 23v120c0 26-21 47-47 47h-59c-26 0-47-21-47-47V188Z" fill="#3F604C" />
                <path d="M208 213h106v89c0 13-10 23-23 23h-60c-13 0-23-10-23-23v-89Z" fill="#D8EF82" />
                <path d="M229 235h64" stroke="#F9F8EF" strokeWidth="5" strokeLinecap="round" strokeOpacity=".8" />
              </g>
            ) : category.toLowerCase().includes('kitch') ? (
              <g className="art-object">
                <path d="M337 212h25c28 0 44 20 44 45s-16 45-44 45h-26" stroke="#314B3D" strokeWidth="18" />
                <path d="M156 207h187l-19 108c-5 27-28 47-55 47h-39c-27 0-50-20-55-47l-19-108Z" fill="#3F604C" />
                <path d="M180 231h140l-12 73c-3 16-17 27-33 27h-50c-16 0-30-11-33-27l-12-73Z" fill="#E7A77F" />
                <path d="M176 195c0-17 14-31 31-31h88c17 0 31 14 31 31v17H176v-17Z" fill="#314B3D" />
                <path d="M215 255h70" stroke="#F9F8EF" strokeWidth="5" strokeLinecap="round" strokeOpacity=".7" />
              </g>
            ) : (
              <g className="art-object">
                <path d="M186 181h146l-16 29c-7 13-11 28-11 43v87c0 24-19 43-43 43h-6c-24 0-43-19-43-43v-87c0-15-4-30-11-43l-16-29Z" fill="#3F604C" />
                <path d="M175 177c0-7 6-13 13-13h142c7 0 13 6 13 13v9c0 7-6 13-13 13H188c-7 0-13-6-13-13v-9Z" fill="#314B3D" />
                <path d="M207 258h104v73c0 16-13 29-29 29h-46c-16 0-29-13-29-29v-73Z" fill="#D8EF82" />
                <path d="M219 277c18-10 37-10 55 0" stroke="#F9F8EF" strokeWidth="5" strokeLinecap="round" strokeOpacity=".8" />
              </g>
            )}
            <path d="M115 152h29M129.5 137.5v29M405 136h22M416 125v22" stroke="#314B3D" strokeWidth="3" strokeLinecap="round" opacity=".56" />
          </svg>
          <span className="art-caption" aria-hidden="true">GOOD THINGS / NEARBY</span>
        </>
      )}
    </div>
  );
}
