const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const STORAGE_KEY = "bakenfry_pwa_v1";
const DEFAULT_PRODUCTS = [
  {id:"pandesal",name:"Pan de Sal",category:"Bread",price:0,emoji:"🥖",description:"Soft Filipino bread rolls",active:true},
  {id:"spanish",name:"Spanish Bread",category:"Bread",price:0,emoji:"🥐",description:"Sweet bread with buttery filling",active:true},
  {id:"coco",name:"Pan de Coco",category:"Bread",price:0,emoji:"🥥",description:"Bread filled with sweet coconut",active:true},
  {id:"ensaymada",name:"Ensaymada",category:"Pastries",price:0,emoji:"🧀",description:"Soft sweet bread with cheese",active:true},
  {id:"kababayan",name:"Kababayan",category:"Pastries",price:0,emoji:"🧁",description:"Classic Filipino muffin bread",active:true},
  {id:"crinkles",name:"Chocolate Crinkles",category:"Sweets",price:0,emoji:"🍪",description:"Chocolate cookies with sugar coating",active:true},
  {id:"cupcake",name:"Chocolate Cupcakes",category:"Sweets",price:0,emoji:"🧁",description:"Chocolate cupcakes",active:true}
];
let state = loadState();
let currentCategory = "All";
let currentCustomer = {};
let currentOrder = null;
let toastTimer;

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved && Array.isArray(saved.products) && Array.isArray(saved.orders)) return saved;
  }catch(e){}
  return {products:DEFAULT_PRODUCTS.map(p=>({...p})),cart:[],orders:[],nextOrder:1};
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function money(n){ return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(n)||0); }
function escapeHTML(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2400);}
function go(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.go===id));
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="cartView")renderCart();
  if(id==="ordersView")renderOrders();
  if(id==="adminView")renderAdmin();
}
function activeProducts(){return state.products.filter(p=>p.active);}
function renderProducts(){
  const items=activeProducts().filter(p=>currentCategory==="All"||p.category===currentCategory);
  $("#productCount").textContent=`${activeProducts().length} items`;
  $("#productGrid").innerHTML=items.map(p=>`
    <article class="product-card">
      <div class="product-art"><span class="tag">${escapeHTML(p.category)}</span>${escapeHTML(p.emoji||"🍞")}</div>
      <div class="product-info"><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||"Fresh from our bakery")}</p>
      <div class="product-bottom"><span class="price">${Number(p.price)>0?money(p.price):"Price not set"}</span><button class="add-btn" data-add="${p.id}" ${Number(p.price)<=0?"disabled":""}>+ Add</button></div></div>
    </article>`).join("");
  $("#emptyProducts").classList.toggle("hidden",items.length>0);
}
function renderCart(){
  const rows=state.cart.map(line=>({...line,product:state.products.find(p=>p.id===line.id)})).filter(x=>x.product);
  const count=state.cart.reduce((n,x)=>n+x.qty,0);
  $("#cartCount").textContent=count;
  $("#cartItems").innerHTML=rows.map(({product:p,qty})=>`
    <div class="cart-row"><div class="cart-thumb">${escapeHTML(p.emoji||"🍞")}</div><div class="cart-details"><b>${escapeHTML(p.name)}</b><small>${money(p.price)} each</small><div class="price">${money(p.price*qty)}</div></div>
    <div class="qty-controls"><button data-qty="${p.id}" data-delta="-1" aria-label="Decrease">−</button><b>${qty}</b><button data-qty="${p.id}" data-delta="1" aria-label="Increase">+</button></div></div>`).join("");
  const total=rows.reduce((n,x)=>n+x.product.price*x.qty,0);
  $("#cartEmpty").classList.toggle("hidden",rows.length>0);
  $("#cartSummary").classList.toggle("hidden",rows.length===0);
  $("#cartSubtotal").textContent=money(total);$("#cartTotal").textContent=money(total);
}
function cartTotal(){return state.cart.reduce((sum,line)=>{const p=state.products.find(x=>x.id===line.id);return sum+(p?p.price*line.qty:0)},0);}
function addToCart(id){
  const p=state.products.find(x=>x.id===id);if(!p||p.price<=0){toast("Set a product price in Manage before ordering.");return;}
  const line=state.cart.find(x=>x.id===id);if(line)line.qty++;else state.cart.push({id,qty:1});
  saveState();renderCart();toast(`${p.name} added to cart.`);
}
function updateQty(id,delta){
  const line=state.cart.find(x=>x.id===id);if(!line)return;line.qty+=delta;if(line.qty<=0)state.cart=state.cart.filter(x=>x.id!==id);
  saveState();renderCart();
}
function renderReview(){
  const c=currentCustomer;
  $("#reviewCustomer").innerHTML=`<b>${escapeHTML(c.name)}</b><br>${escapeHTML(c.address)}<br>${escapeHTML(c.phone)}${c.email?`<br>${escapeHTML(c.email)}`:""}`;
  $("#reviewItems").innerHTML=state.cart.map(x=>{const p=state.products.find(y=>y.id===x.id);return p?`<div class="review-item"><span>${escapeHTML(p.name)} <small>× ${x.qty}</small></span><b>${money(p.price*x.qty)}</b></div>`:""}).join("");
  $("#reviewTotal").textContent=money(cartTotal());
}
function orderNumber(n){return "BNF-"+String(n).padStart(4,"0");}
function formatDate(d){return new Date(d).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"});}
function confirmOrder(){
  if(!state.cart.length){toast("Your cart is empty.");return;}
  const items=state.cart.map(x=>{const p=state.products.find(y=>y.id===x.id);return {id:x.id,name:p.name,price:Number(p.price),qty:x.qty,emoji:p.emoji};});
  const order={number:orderNumber(state.nextOrder++),date:new Date().toISOString(),customer:{...currentCustomer},items,total:items.reduce((n,x)=>n+x.price*x.qty,0),status:"New"};
  state.orders.unshift(order);state.cart=[];currentOrder=order;saveState();renderSuccess(order);go("successView");
}
function receiptHTML(order){
  return `<div class="receipt-brand"><b>BAKE N FRY TREATS</b><small>FILIPINO BAKERY • ORDER SLIP</small></div>
  <div class="receipt-meta"><b>Order:</b> ${escapeHTML(order.number)}<br><b>Date:</b> ${escapeHTML(formatDate(order.date))}<br><br><b>Customer:</b> ${escapeHTML(order.customer.name)}<br><b>Address:</b> ${escapeHTML(order.customer.address)}<br><b>Contact:</b> ${escapeHTML(order.customer.phone)}${order.customer.email?`<br><b>Email:</b> ${escapeHTML(order.customer.email)}`:""}</div>
  <table class="receipt-table"><thead><tr><td><b>ITEM</b></td><td><b>QTY</b></td><td><b>AMOUNT</b></td></tr></thead><tbody>${order.items.map(x=>`<tr><td>${escapeHTML(x.name)}<br><small>${money(x.price)} each</small></td><td>${x.qty}</td><td>${money(x.price*x.qty)}</td></tr>`).join("")}</tbody></table>
  <div class="receipt-total"><span>TOTAL</span><span>${money(order.total)}</span></div><p style="text-align:center;font-size:10px;color:#857873;margin:18px 0 0">Thank you for ordering with BAKE N FRY Treats!</p>`;
}
function renderSuccess(order){
  $("#successOrderNumber").textContent=order.number;$("#successDate").textContent=formatDate(order.date);$("#receiptContent").innerHTML=receiptHTML(order);
}
function renderOrders(){
  $("#ordersList").innerHTML=state.orders.map(o=>`<article class="admin-order"><div class="admin-order-head"><b>${escapeHTML(o.number)}</b><b>${money(o.total)}</b></div><small>${escapeHTML(formatDate(o.date))} • ${escapeHTML(o.customer.name)}</small><p style="font-size:11px;color:#857873;margin:8px 0">${o.items.map(x=>`${escapeHTML(x.name)} × ${x.qty}`).join(", ")}</p><button class="secondary-btn" data-view-order="${o.number}">View receipt</button></article>`).join("");
  $("#ordersEmpty").classList.toggle("hidden",state.orders.length>0);
}
function showSavedOrder(number){const o=state.orders.find(x=>x.number===number);if(!o)return;currentOrder=o;renderSuccess(o);go("successView");}
function renderAdmin(){
  $("#adminProducts").innerHTML=`<button class="primary-btn full" id="addProductBtn">+ Add product</button>`+state.products.map(p=>`<div class="admin-product"><span class="emoji">${escapeHTML(p.emoji||"🍞")}</span><div class="grow"><b>${escapeHTML(p.name)}</b><small>${escapeHTML(p.category)} • ${p.active?"Visible":"Hidden"} • ${money(p.price)}</small></div><button data-edit-product="${p.id}">Edit</button></div>`).join("");
  $("#adminOrders").innerHTML=state.orders.length?state.orders.map(o=>`<div class="admin-order"><div class="admin-order-head"><b>${escapeHTML(o.number)}</b><b>${money(o.total)}</b></div><small>${escapeHTML(o.customer.name)} • ${escapeHTML(formatDate(o.date))}</small><div style="margin-top:10px"><select data-status="${o.number}">${["New","Preparing","Ready","Completed","Cancelled"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select> <button class="secondary-btn" data-view-order="${o.number}">Receipt</button></div></div>`).join(""):`<div class="empty-card">No orders saved yet.</div>`;
}
function editProduct(id){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  const name=prompt("Product name:",p.name);if(name===null)return;if(!name.trim()){toast("Name cannot be empty.");return;}
  const priceText=prompt("Price in pesos (example: 12.50):",String(p.price));if(priceText===null)return;
  const price=Number(priceText);if(!Number.isFinite(price)||price<0){toast("Enter a valid price.");return;}
  const category=prompt("Category: Bread, Pastries, or Sweets",p.category);if(category===null)return;
  const desc=prompt("Short description:",p.description||"");if(desc===null)return;
  const emoji=prompt("Product emoji:",p.emoji||"🍞");if(emoji===null)return;
  const visible=confirm("Show this product in the shop? Choose Cancel to hide it.");
  Object.assign(p,{name:name.trim(),price,category:["Bread","Pastries","Sweets"].includes(category)?category:"Bread",description:desc,emoji,active:visible});
  saveState();renderProducts();renderAdmin();toast("Product updated.");
}
function addProduct(){
  const name=prompt("New product name:");if(!name||!name.trim())return;
  const price=Number(prompt("Price in pesos (enter 0 if not set):","0"));if(!Number.isFinite(price)||price<0){toast("Invalid price.");return;}
  const p={id:"item-"+Date.now(),name:name.trim(),price,category:"Bread",description:"Fresh from our bakery",emoji:"🍞",active:true};
  state.products.push(p);saveState();renderProducts();renderAdmin();toast("Product added. Edit it to customize category and details.");
}
function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="bake-n-fry-backup.json";a.click();URL.revokeObjectURL(url);
}
function importBackup(file){
  const reader=new FileReader();reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!Array.isArray(x.products)||!Array.isArray(x.orders)||!Array.isArray(x.cart))throw Error();state={products:x.products,orders:x.orders,cart:x.cart,nextOrder:Number(x.nextOrder)||1};saveState();renderProducts();renderAdmin();toast("Backup imported.");}catch(e){toast("That backup file is not valid.");}};reader.readAsText(file);
}
function downloadReceiptJpg(){
  if(!currentOrder)return;
  const o=currentOrder,canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
  const w=900,pad=65,lineH=42,rows=o.items.length;
  const h=760+rows*lineH;canvas.width=w;canvas.height=h;
  ctx.fillStyle="#fffaf2";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#7b2d26";ctx.fillRect(0,0,w,18);
  ctx.textAlign="center";ctx.fillStyle="#7b2d26";ctx.font="bold 38px Arial";ctx.fillText("BAKE N FRY TREATS",w/2,90);
  ctx.fillStyle="#857873";ctx.font="18px Arial";ctx.fillText("FILIPINO BAKERY  •  ORDER SLIP",w/2,126);
  ctx.strokeStyle="#cdbdb0";ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(pad,155);ctx.lineTo(w-pad,155);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign="left";ctx.fillStyle="#2d2421";ctx.font="bold 22px Arial";
  let y=205;ctx.fillText(`Order: ${o.number}`,pad,y);ctx.font="18px Arial";y+=38;ctx.fillText(`Date: ${formatDate(o.date)}`,pad,y);y+=42;
  ctx.font="bold 19px Arial";ctx.fillText(`Customer: ${o.customer.name}`,pad,y);y+=32;ctx.font="18px Arial";
  const wrap=(text,max)=>{let words=String(text).split(" "),lines=[],line="";for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>max&&line){lines.push(line);line=word}else line=test;}if(line)lines.push(line);return lines;};
  for(const line of wrap(`Address: ${o.customer.address}`,w-2*pad)){ctx.fillText(line,pad,y);y+=27;}
  ctx.fillText(`Contact: ${o.customer.phone}`,pad,y);y+=30;if(o.customer.email){ctx.fillText(`Email: ${o.customer.email}`,pad,y);y+=30;}
  y+=15;ctx.strokeStyle="#e8ddd2";ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();y+=35;
  ctx.font="bold 18px Arial";ctx.fillText("ITEM",pad,y);ctx.textAlign="center";ctx.fillText("QTY",w-270,y);ctx.textAlign="right";ctx.fillText("AMOUNT",w-pad,y);y+=22;
  ctx.font="18px Arial";ctx.textAlign="left";
  for(const item of o.items){y+=35;ctx.fillText(item.name,pad,y);ctx.textAlign="center";ctx.fillText(String(item.qty),w-270,y);ctx.textAlign="right";ctx.fillText(money(item.price*item.qty),w-pad,y);ctx.textAlign="left";ctx.fillStyle="#857873";ctx.font="14px Arial";ctx.fillText(`${money(item.price)} each`,pad,y+19);ctx.fillStyle="#2d2421";ctx.font="18px Arial";y+=20;}
  y+=35;ctx.strokeStyle="#cdbdb0";ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();ctx.setLineDash([]);
  y+=55;ctx.font="bold 27px Arial";ctx.fillStyle="#7b2d26";ctx.fillText("TOTAL",pad,y);ctx.textAlign="right";ctx.fillText(money(o.total),w-pad,y);
  y+=75;ctx.textAlign="center";ctx.font="18px Arial";ctx.fillStyle="#857873";ctx.fillText("Thank you for ordering with BAKE N FRY Treats!",w/2,y);
  const a=document.createElement("a");a.download=`${o.number}-BAKE-N-FRY.jpg`;a.href=canvas.toDataURL("image/jpeg",.94);a.click();
}
function printReceipt(){window.print();}

document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]");if(add)addToCart(add.dataset.add);
  const qty=e.target.closest("[data-qty]");if(qty)updateQty(qty.dataset.qty,Number(qty.dataset.delta));
  const goBtn=e.target.closest("[data-go]");if(goBtn)go(goBtn.dataset.go);
  const edit=e.target.closest("[data-edit-product]");if(edit)editProduct(edit.dataset.editProduct);
  const view=e.target.closest("[data-view-order]");if(view)showSavedOrder(view.dataset.viewOrder);
  const cat=e.target.closest("[data-category]");if(cat){currentCategory=cat.dataset.category;$$("[data-category]").forEach(x=>x.classList.toggle("selected",x===cat));renderProducts();}
  const tab=e.target.closest("[data-admin-tab]");if(tab){$$("[data-admin-tab]").forEach(x=>x.classList.toggle("selected",x===tab));["products","orders","data"].forEach(k=>$("#admin"+k[0].toUpperCase()+k.slice(1)).classList.toggle("hidden",k!==tab.dataset.adminTab));}
});
$("#cartOpen").addEventListener("click",()=>go("cartView"));
$("#homeBtn").addEventListener("click",()=>go("shopView"));
$("#browseBtn").addEventListener("click",()=>$("#productsAnchor").scrollIntoView({behavior:"smooth"}));
$("#checkoutBtn").addEventListener("click",()=>{if(!state.cart.length)return;go("customerView");});
$("#customerForm").addEventListener("submit",e=>{
  e.preventDefault();const fd=new FormData(e.currentTarget);currentCustomer={name:String(fd.get("name")).trim(),address:String(fd.get("address")).trim(),phone:String(fd.get("phone")).trim(),email:String(fd.get("email")).trim()};
  if(!currentCustomer.name||!currentCustomer.address||!currentCustomer.phone){toast("Please complete the required fields.");return;}
  renderReview();go("reviewView");
});
$("#confirmOrderBtn").addEventListener("click",confirmOrder);
$("#downloadJpgBtn").addEventListener("click",downloadReceiptJpg);
$("#printPdfBtn").addEventListener("click",printReceipt);
$("#newOrderBtn").addEventListener("click",()=>{currentOrder=null;currentCustomer={};$("#customerForm").reset();go("shopView");});
$("#addProductBtn")?.addEventListener("click",addProduct);
document.addEventListener("change",e=>{
  if(e.target.matches("[data-status]")){const o=state.orders.find(x=>x.number===e.target.dataset.status);if(o){o.status=e.target.value;saveState();toast("Order status updated.");}}
  if(e.target.id==="importDataInput"&&e.target.files[0])importBackup(e.target.files[0]);
});
$("#exportDataBtn").addEventListener("click",exportBackup);
$("#clearOrdersBtn").addEventListener("click",()=>{if(confirm("Permanently delete all saved orders on this device?")){state.orders=[];saveState();renderAdmin();toast("Saved orders deleted.");}});
$("#adminProducts").addEventListener("click",e=>{if(e.target.id==="addProductBtn")addProduct();});
function updateOnline(){const online=navigator.onLine;$("#connectionState").textContent=online?"● Online / offline-ready":"● Offline mode";$("#connectionState").style.color=online?"#3f7554":"#9b622e";}
window.addEventListener("online",updateOnline);window.addEventListener("offline",updateOnline);
renderProducts();renderCart();updateOnline();
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Service worker registration failed",err)));}
