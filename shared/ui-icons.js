const namespace = "http://www.w3.org/2000/svg";
export function createIcon(name, className = "ui-icon") {
  const svg = document.createElementNS(namespace, "svg"), use = document.createElementNS(namespace, "use");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
  svg.setAttribute("width", "18"); svg.setAttribute("height", "18"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.8");
  svg.style.width = "18px"; svg.style.height = "18px"; svg.style.maxWidth = "18px"; svg.style.maxHeight = "18px"; svg.style.flexShrink = "0";
  svg.setAttribute("class", className); use.setAttribute("href", new URL(`./vendor/lucide/${name}.svg#icon`, import.meta.url).href);
  svg.append(use); return svg;
}
