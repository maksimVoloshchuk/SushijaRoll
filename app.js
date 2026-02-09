// Берём меню из menu-data.js
const data = window.MENU_DATA || [];
const settings = { currency: "€", deliveryFee: 2.90, freeDeliveryFrom: 35.00 };

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const money = (n)=>`${settings.currency}${Number(n).toFixed(2)}`;

const state = {
  cart: JSON.parse(localStorage.getItem("sushi_cart") || "{}"),
  search: ""
};

function save(){ localStorage.setItem("sushi_cart", JSON.stringify(state.cart)); }
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function escapeAttr(str){ return escapeHtml(str).replaceAll("`","&#096;"); }

function flattenItems(){
  const all=[];
  for(const cat of data){
    for(const item of cat.items){
      all.push({ ...item, catTitle: cat.title });
    }
  }
  return all;
}

function getQty(id){ return state.cart[id] || 0; }
function setQty(id, qty){
  if(qty<=0) delete state.cart[id];
  else state.cart[id]=qty;
  save();
  renderCart();
  renderBadges();
  document.querySelectorAll(`[data-qval="${CSS.escape(id)}"]`).forEach(el => el.textContent = getQty(id));
}
function inc(id){ setQty(id, getQty(id)+1); }
function dec(id){ setQty(id, getQty(id)-1); }

/* CATEGORY NAV */
function renderCategoryNav(){
  const nav=$("#catbar");
  nav.innerHTML = data.map((c,i)=>`
    <a class="catbtn ${i===0?"active":""}" href="#sec-${c.id}">${escapeHtml(c.title)}</a>
  `).join("");
}

/* MENU */
function renderCard(it){
  const qty=getQty(it.id);
  const tags=[];
  if(it.isNew) tags.push(`<span class="tag new">NEW</span>`);
  if(it.hot) tags.push(`<span class="tag hot">HOT</span>`);

  const metaParts=[];
  if(it.pieces) metaParts.push(`${it.pieces} шт`);
  if(it.grams) metaParts.push(`${it.grams} г`);
  const meta = metaParts.length ? `<span class="tag">${metaParts.join(" • ")}</span>` : "";

  const img = (it.img || "").trim();
  const thumb = img
    ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(it.name||"Фото")}" loading="lazy"
         onerror="this.remove(); this.parentElement.querySelector('.ph').style.display='flex';">`
    : ``;

  return `
    <article class="card" data-item-id="${escapeAttr(it.id)}">
      <div class="card-top">
        <div class="thumb">
          ${thumb}
          <div class="ph" style="${img ? "display:none" : "display:flex"}">PHOTO</div>
        </div>
        <div>
          <h4>${escapeHtml(it.name)}</h4>
          <p class="desc">${escapeHtml(it.desc || "")}</p>
          <div class="meta">${meta}${tags.join("")}</div>
        </div>
      </div>

      <div class="card-bottom">
        <div class="price">
          ${money(it.price || 0)}
          <small>${escapeHtml(it.catTitle || "")}</small>
        </div>

        <div class="qty">
          <button class="qbtn" data-minus="${escapeAttr(it.id)}" title="Минус">−</button>
          <div class="qval" data-qval="${escapeAttr(it.id)}">${qty}</div>
          <button class="qbtn" data-plus="${escapeAttr(it.id)}" title="Плюс">+</button>
          <button class="addbtn" data-add="${escapeAttr(it.id)}" title="В корзину">В корзину</button>
        </div>
      </div>
    </article>
  `;
}

function renderMenu(){
  const root=$("#menuRoot");
  const q=state.search.trim().toLowerCase();
  root.innerHTML="";

  for(const cat of data){
    const items = cat.items
      .map(it=>({ ...it, catTitle: cat.title }))
      .filter(it=>{
        if(!q) return true;
        return (it.name+" "+(it.desc||"")+(it.recipe||"")).toLowerCase().includes(q);
      });

    if(q && items.length===0) continue;

    const sec=document.createElement("section");
    sec.className="section";
    sec.id=`sec-${cat.id}`;
    sec.innerHTML = `
      <div class="section-head">
        <div>
          <h2 class="section-title">${escapeHtml(cat.title)}</h2>
          <p class="section-note">${escapeHtml(cat.note || "")}</p>
        </div>
        <p class="section-note">${items.length} поз.</p>
      </div>
      <div class="grid">${items.map(renderCard).join("")}</div>
    `;
    root.appendChild(sec);
  }

  $$("[data-add]").forEach(b=>b.addEventListener("click", ()=>inc(b.getAttribute("data-add"))));
  $$("[data-plus]").forEach(b=>b.addEventListener("click", ()=>inc(b.getAttribute("data-plus"))));
  $$("[data-minus]").forEach(b=>b.addEventListener("click", ()=>dec(b.getAttribute("data-minus"))));

  document.querySelectorAll("[data-item-id]").forEach(card=>{
    card.addEventListener("click", (e)=>{
      if(e.target.closest("button")) return;
      const id = card.getAttribute("data-item-id");
      const item = flattenItems().find(x=>x.id===id);
      if(item) showItemModal(item);
    });
  });
}

/* CART */
function renderBadges(){
  const count = Object.values(state.cart).reduce((a,b)=>a+b,0);
  $("#cartCount").textContent=count;
  $("#cartCount2").textContent=count;
}

function cartTotals(){
  const items=flattenItems();
  let sub=0;
  for(const [id,qty] of Object.entries(state.cart)){
    const it=items.find(x=>x.id===id);
    if(it) sub += (Number(it.price)||0)*qty;
  }
  const delivery = (sub>=settings.freeDeliveryFrom || sub===0) ? 0 : settings.deliveryFee;
  return { sub, delivery, total: sub+delivery };
}

function renderCart(){
  const wrap=$("#cartItems");
  const empty=$("#emptyCart");
  const totalsBox=$("#totals");
  const items=flattenItems();

  const keys=Object.keys(state.cart);
  if(keys.length===0){
    wrap.innerHTML="";
    empty.style.display="block";
    totalsBox.style.display="none";
    return;
  }
  empty.style.display="none";

  wrap.innerHTML = keys.map(id=>{
    const it=items.find(x=>x.id===id);
    const qty=getQty(id);
    if(!it) return "";
    return `
      <div class="cart-item">
        <div>
          <p class="name">${escapeHtml(it.name)}</p>
          <p class="sub"><span>${qty} × ${money(it.price||0)}</span><span>•</span><span>${money((it.price||0)*qty)}</span></p>
        </div>
        <div class="cart-controls">
          <button class="mini" data-minus="${escapeAttr(id)}">−</button>
          <button class="mini" data-plus="${escapeAttr(id)}">+</button>
          <button class="mini red" data-remove="${escapeAttr(id)}">✖</button>
        </div>
      </div>
    `;
  }).join("");

  const t=cartTotals();
  $("#subTotal").textContent=money(t.sub);
  $("#delivery").textContent=money(t.delivery);
  $("#grandTotal").textContent=money(t.total);
  totalsBox.style.display="block";

  $$("[data-remove]").forEach(b=>b.addEventListener("click", ()=>setQty(b.getAttribute("data-remove"),0)));
  $$(`#cartItems [data-plus]`).forEach(b=>b.addEventListener("click", ()=>inc(b.getAttribute("data-plus"))));
  $$(`#cartItems [data-minus]`).forEach(b=>b.addEventListener("click", ()=>dec(b.getAttribute("data-minus"))));
}

function clearCart(){
  state.cart={};
  save();
  renderCart();
  renderBadges();
  $$(".qval").forEach(el=>el.textContent="0");
}

function updateActiveCategory(){
  const sections = data.map(c=>document.getElementById(`sec-${c.id}`)).filter(Boolean);
  let active = sections[0]?.id || "";
  const y = window.scrollY + 160;
  for(const s of sections){ if(s.offsetTop<=y) active=s.id; }
  $$("#catbar .catbtn").forEach(a=>{
    const id=a.getAttribute("href").slice(1);
    a.classList.toggle("active", id===active);
  });
}

/* MODAL + ICONS */
let currentModalItemId = null;

function openModal(){
  const m = $("#itemModal");
  m.classList.add("show");
  m.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeModal(){
  const m = $("#itemModal");
  m.classList.remove("show");
  m.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}

function ingredientIcon(name){
  const n = String(name||"").toLowerCase().trim();
  const map = [
    { keys:["яблуко","яблоко","apple"], ico:"🍏" },
    { keys:["авокадо","avocado"], ico:"🥑" },
    { keys:["лосось","salmon","копч"], ico:"🐟" },
    { keys:["тунець","тунец","tuna"], ico:"🐟" },
    { keys:["вугор","угор","eel","unagi"], ico:"🐟" },
    { keys:["креветка","криветка","shrimp","ebi"], ico:"🦐" },
    { keys:["краб","crab"], ico:"🦀" },
    { keys:["огірок","огурец","cucumber"], ico:"🥒" },
    { keys:["манго","mango"], ico:"🥭" },
    { keys:["перець","перец","pepper","чили","chili"], ico:"🌶️" },
    { keys:["сыр","сир","cheese","philadelphia","филадельф"], ico:"🧀" },
    { keys:["рис","rice"], ico:"🍚" },
    { keys:["нори","норі","nori"], ico:"🌿" },
    { keys:["кунжут","sesame"], ico:"⚪" },
    { keys:["ікра","икра","масаго","masago"], ico:"🟠" },
    { keys:["чука","wakame","вакаме","вакам"], ico:"🥗" },
    { keys:["унагі"], ico:"🍯" },
    { keys:["теріякі","терияки","teriyaki"], ico:"🍶" },
    { keys:["чеснок","часник","garlic"], ico:"🧄" },
    { keys:["темпура","панко","panko","tempura","кляр"], ico:"🍤" },
    { keys:["тофу","tofu"], ico:"⬜" },
    { keys:["курка","куриц","chicken"], ico:"🍗" },
    { keys:["гриби","гриб","mushroom"], ico:"🍄" },
    { keys:["цибуля","лук","onion"], ico:"🧅" }
  ];
  for(const row of map){
    if(row.keys.some(k=>n.includes(k))) return row.ico;
  }
  return "🍽️";
}

function parseIngredients(desc){
  const raw = String(desc||"").trim();
  if(!raw) return [];
  if(raw.includes("•")) return raw.split("•").map(s=>s.trim()).filter(Boolean);
  return raw.split(",").map(s=>s.trim()).filter(Boolean);
}

function setModalImage(item){
  const wrap = $("#mImgWrap");
  const url = String(item.img || "").trim();
  if(url){
    wrap.innerHTML = `<img src="${escapeAttr(url)}" alt="${escapeAttr(item.name||"Фото")}" loading="lazy"
      onerror="this.remove(); this.parentElement.innerHTML='<div class=&quot;ph&quot;>PHOTO</div>';">`;
  } else {
    wrap.innerHTML = `<div class="ph">PHOTO</div>`;
  }
}

function showItemModal(item){
  currentModalItemId = item.id;

  $("#mTitle").textContent = item.name || "Позиция";
  const meta = [
    item.pieces ? `${item.pieces} шт` : null,
    item.grams ? `${item.grams} г` : null
  ].filter(Boolean).join(" • ");
  $("#mMeta").textContent = meta || "—";
  $("#mPrice").textContent = money(Number(item.price || 0));

  setModalImage(item);

  const ingr = parseIngredients(item.desc || "");
  const box = $("#mChips");
  box.innerHTML = ingr.length
    ? ingr.map(x=>`<span class="chip"><span class="ico">${ingredientIcon(x)}</span><span>${escapeHtml(x)}</span></span>`).join("")
    : `<span class="chip"><span class="ico">🍽️</span><span>Нет состава</span></span>`;

  $("#mRecipe").textContent = item.recipe || "—";
  $("#mDesc").textContent = item.desc || "—";

  openModal();
}

/* INIT */
renderCategoryNav();
renderMenu();
renderCart();
renderBadges();
updateActiveCategory();

$("#search").addEventListener("input",(e)=>{
  state.search = e.target.value;
  renderMenu();
  updateActiveCategory();
});
window.addEventListener("scroll", ()=>updateActiveCategory(), { passive:true });

$("#clearCart").addEventListener("click", clearCart);
$("#clearCart2").addEventListener("click", clearCart);
$("#openCheckout").addEventListener("click", ()=>window.scrollTo({ top: 0, behavior: "smooth" }));

$("#mClose").addEventListener("click", closeModal);
$("#itemModal").addEventListener("click", (e)=>{ if(e.target.id==="itemModal") closeModal(); });
window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

$("#mAdd").addEventListener("click", ()=>{ if(currentModalItemId) inc(currentModalItemId); });
$("#mAdd2").addEventListener("click", ()=>{ if(currentModalItemId) inc(currentModalItemId); });
const cartModal = document.getElementById("cartModal");
const openCheckout = document.getElementById("openCheckout");
const cartClose = document.getElementById("cartClose");
const cartClose2 = document.getElementById("cartClose2");

openCheckout.addEventListener("click", () => {
  cartModal.classList.add("show");

  const sideCart = document.getElementById("cartItems");
  const modalCart = document.getElementById("cartItemsModal");

  modalCart.innerHTML = sideCart.innerHTML;
});


cartClose.addEventListener("click", () => {
  cartModal.classList.remove("show");
});

cartClose2.addEventListener("click", () => {
  cartModal.classList.remove("show");
});
