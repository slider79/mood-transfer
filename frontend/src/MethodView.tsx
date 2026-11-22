// viva ke liye: method seedhi zubaan mein
export default function MethodView() {
  return (
    <article className="method">
      <h1>How the mood gets transferred</h1>
      <p className="lede">
        Mood is mostly colour, tone and light: the palette of the shadows and highlights, how warm the light is, where the frame
        falls off into darkness. So instead of letting a network repaint the photo, we let it judge a small, safe colour grade and
        keep tuning that grade until the photo carries the reference's mood.
      </p>

      <figure className="pipeline" aria-label="Pipeline">
        <svg viewBox="0 0 640 230" role="img" aria-label="Content and mood photos go to VGG-19 features; losses update a 3D LUT and a light grid; the grade is applied to the full size photo">
          <g className="pl-box">
            <rect x="2" y="88" width="140" height="50" />
            <text x="72" y="118">Content photo</text>
            <rect x="2" y="176" width="140" height="50" />
            <text x="72" y="206">Mood photo</text>
            <rect x="182" y="88" width="180" height="50" className="pl-hot" />
            <text x="272" y="118">3D LUT + light grid</text>
            <rect x="402" y="88" width="140" height="50" />
            <text x="472" y="118">VGG-19 judge</text>
            <rect x="402" y="2" width="236" height="50" />
            <text x="520" y="32">Full size print</text>
          </g>
          <g className="pl-line">
            <path d="M142 113h40" />
            <path d="M142 201h330v-63" />
            <path d="M362 113h40" />
            <path d="M472 138v20H272v-20" />
            <path d="M272 88V27h130" />
          </g>
          <text x="372" y="174" className="pl-note">losses push the grade</text>
        </svg>
      </figure>

      <h2>The grade we learn</h2>
      <p>
        A <strong>3D LUT</strong> of 17 x 17 x 17 colours maps every input colour to an output colour, with trilinear interpolation in
        between. It can warm shadows, cool highlights, desaturate greens and so on, but it cannot invent texture, so the result is
        always still a photograph. An <strong>8 x 8 light grid</strong>, smoothly upsampled, multiplies brightness per region, which
        covers vignettes, glows and light falloff that a LUT alone cannot do.
      </p>

      <h2>How VGG-19 judges it</h2>
      <p>
        The graded photo and the mood photo both go through a pretrained VGG-19. The loss has three parts. <strong>Style</strong>:
        Gram matrices at relu1_1 to relu4_1 compare the statistics of the two images, which is where the feel of a photo lives.
        <strong> Colour</strong>: a sliced Wasserstein distance between the two pixel colour clouds, projected on random directions and
        sorted, so the whole colour distribution matches and not just its mean. <strong>Content</strong>: relu4_2 features of the
        graded photo stay close to the original, so the scene does not drift. Two regularisers keep the LUT smooth and monotonic, so
        colours never flip.
      </p>

      <h2>Why it runs on a laptop</h2>
      <p>
        The optimisation runs at 256 pixels with Adam for 60 to 200 steps, about 15 to 50 seconds on a CPU. The LUT is resolution
        free, so it is then applied to the full size photo in about a second. The LUT starts from the Reinhard transfer instead of
        identity, which makes it converge faster.
      </p>

      <h2>What we compare against</h2>
      <p>
        The baseline is Reinhard et al. (2001): convert both photos to the l alpha beta colour space and match the mean and standard
        deviation of each channel. It is fast but it moves every pixel the same way, so it often goes flat or muddy, which is exactly
        what the learned grade is meant to fix.
      </p>

      <h2>What we added</h2>
      <ul>
        <li>Learning a parametric grade (LUT plus light grid) with neural losses, instead of optimising pixels or running a style network.</li>
        <li>The sliced Wasserstein colour loss next to the Gram style loss.</li>
        <li>Warm starting the LUT from the classical Reinhard transfer.</li>
        <li>Exporting the mood as a standard .cube file and reusing saved moods on new photos without another run.</li>
      </ul>
    </article>
  )
}
