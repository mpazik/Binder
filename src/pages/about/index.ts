import { navigationView } from "../../components/navigation";
import {
  a,
  b,
  ComponentBody,
  div,
  fragment,
  img,
  JsonHtml,
  p,
  source,
  span,
  video,
} from "../../libs/simple-ui/render";

function featureSection(title: string, description: JsonHtml, imgSrc: string) {
  return div(
    { class: "flex-1" },
    img({
      src: imgSrc,
      style: { maxWidth: "100%", filter: "saturate(80%)" },
      class: "my-4 color-shadow-medium",
    }),
    p({ class: "h5-mktg" }, title),
    p({ class: "f4-mktg" }, description)
  );
}

export const AboutPage: ComponentBody<void> = (render) => {
  render(
    fragment(
      navigationView({}),
      div({ class: "mt-10" }),
      div(
        {
          class: "marketing-content py-6",
        },
        div(
          { class: "d-flex flex-items-center", style: { gap: "48px" } },
          div(
            { style: { flex: "2" } },
            p({ class: "h3-mktg" }, "Single place for your documents"),
            p(
              { class: "f3-mktg" },
              "All your ",
              b("articles, ebooks, notes"),
              " in ONE place; synchronised with your cloud drive, with full privacy, display preferences, personal comments, search, categorization, and offline access\n"
            ),
            // p({ class: "f3-mktg" }, "Boost your research and learning!"),
            div(
              { class: "f3 mt-4" },
              a(
                { href: "/", class: "btn btn-large  btn-primary px-4 py-2" },
                "Go to docland"
              )
            )
          ),
          div(
            { style: { flex: "3" } },

            video(
              { controls: undefined, style: { maxWidth: "100%" } },
              source({
                src:
                  " https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
                type: "video/webm",
              }),
              source({
                src:
                  " https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
                type: "video/mp4",
              }),
              "Your browser does not support HTML5 video."
            )
            //         <video id="video1" style="width:600px;max-width:100%;" controls="">
            // <source src="mov_bbb.mp4" type="video/mp4">
            // <source src="mov_bbb.ogg" type="video/ogg">
            //
            // </video>
          )
        )
      ),
      div(
        {
          class: "color-bg-secondary p-2 py-6 mt-4 ",
        },
        div(
          {
            class: "marketing-content d-flex flex-column",
            style: { gap: "48px" },
          },
          div(
            {
              class: "d-flex flex-justify-between",
              style: { gap: "48px" },
            },
            featureSection(
              "Read on your terms",
              "Stretched text, small font, clutter on the page? Docland cleans up all the noise leaving you with the pure content displayed to your preferences.",
              "display.png"
            ),
            featureSection(
              "Save forever",
              span(
                "Never loos your favorite articles. Docland uses your personal cloud drive to store information in open file formats, to make you able access your data forever."
              ),
              "save.png"
            ),
            featureSection(
              "Speed up learning",
              span(
                "Do active reading and quick review by adding ",
                b("highlights and comments"),
                ". Remember information quickly and for a long time",
                "."
              ),
              "annotations.png"
            )
          ),
          div(
            {
              class: "d-flex",
              style: { gap: "48px" },
            },
            featureSection(
              "PDF and EPUB support",
              "Manage all of your web articles, PDF documents and ebooks in a single place. Quick search trough all your favourite book quotes, skim trough all notes and highlights from a school subject, all this is now possible",
              "epub.png"
            ),
            featureSection(
              "Instant response",
              "No more loading screens to access recent page. Documents are also stored on your machine to displayed documents  and give you search results instantly.",
              "instant.png"
            ),
            featureSection(
              "Own your data",
              "No one besides you, your browser and your private cloud drive has access to your data. Docland is fully open sourced and use only open file formats.",
              "privacy.png"
            )
          ),
          div(
            { class: "f4 color-text-danger" },
            "* Docland is in beta version, not all of the features are fully implemented yet."
          )
        )
      )
      // div(
      //   { class: "marketing-content" },
      //   p({ class: "h4-mktg my-6" }, "Let's stay in touch")
      // )
    )
  );
};
