/*
 * Duotone print processes for monochrome phyla (see styles/phylum.css).
 * Luminance is mapped onto three stops — dark ink, mid wash, white paper — so
 * whitened plate grounds stay white and keep multiplying into the page.
 */

const TONES: Record<string, { dark: [number, number, number]; mid: [number, number, number] }> = {
  algorithms: { dark: [0.369, 0.141, 0.078], mid: [0.69, 0.341, 0.227] }, // sanguine
  theory: { dark: [0.059, 0.165, 0.29], mid: [0.184, 0.373, 0.561] }, // cyanotype
  networking: { dark: [0.18, 0.204, 0.235], mid: [0.478, 0.514, 0.561] }, // silverpoint
  databases: { dark: [0.071, 0.247, 0.227], mid: [0.243, 0.549, 0.502] }, // verdigris
  ml: { dark: [0.165, 0.106, 0.251], mid: [0.431, 0.31, 0.58] }, // iron-gall violet
  security: { dark: [0.247, 0.173, 0.071], mid: [0.604, 0.455, 0.251] }, // bronze
};

export function PlateTones() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute size-0 overflow-hidden">
      <defs>
        {Object.entries(TONES).map(([id, { dark, mid }]) => (
          <filter key={id} id={`pw-tone-${id}`} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncR type="table" tableValues={`${dark[0]} ${mid[0]} 1`} />
              <feFuncG type="table" tableValues={`${dark[1]} ${mid[1]} 1`} />
              <feFuncB type="table" tableValues={`${dark[2]} ${mid[2]} 1`} />
            </feComponentTransfer>
          </filter>
        ))}
      </defs>
    </svg>
  );
}
