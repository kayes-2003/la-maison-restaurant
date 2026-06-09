#!/usr/bin/env bash
# =============================================================
#  La Maison — Terminal Management Script
#  Usage: bash scripts/manage.sh <command>
# =============================================================

set -e

# Load .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY}"   # needs service role for admin ops

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✖${NC}  $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }

require_curl() { command -v curl &>/dev/null || error "curl not found. Install it first."; }
require_jq()   { command -v jq   &>/dev/null || error "jq not found. Run: brew install jq  OR  apt install jq"; }
require_env()  {
  [ -z "$SUPABASE_URL" ] && error "VITE_SUPABASE_URL not set in .env"
  [ -z "$SUPABASE_KEY" ] && error "VITE_SUPABASE_SERVICE_ROLE_KEY not set in .env (needed for admin ops)"
}

# ─────────────────────────────────────────────────────────────────────────────
#  USERS
# ─────────────────────────────────────────────────────────────────────────────

cmd_list_users() {
  require_curl; require_jq; require_env
  header "All Users"
  curl -s "${SUPABASE_URL}/rest/v1/profiles?select=id,email,role,created_at&order=created_at.asc" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '.[] | "\(.role | ascii_upcase)\t\(.email)\t\(.id)"' \
    | column -t
  echo ""
}

cmd_make_admin() {
  require_curl; require_jq; require_env
  local EMAIL="$1"
  [ -z "$EMAIL" ] && error "Usage: manage.sh make-admin <email>"
  info "Granting admin role to: $EMAIL"
  RES=$(curl -s -X PATCH \
    "${SUPABASE_URL}/rest/v1/profiles?email=eq.${EMAIL}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{"role":"admin"}')
  echo "$RES" | jq -e '.[0]' &>/dev/null \
    && success "$EMAIL is now admin" \
    || error "User not found or update failed: $RES"
}

cmd_remove_admin() {
  require_curl; require_jq; require_env
  local EMAIL="$1"
  [ -z "$EMAIL" ] && error "Usage: manage.sh remove-admin <email>"
  info "Removing admin role from: $EMAIL"
  RES=$(curl -s -X PATCH \
    "${SUPABASE_URL}/rest/v1/profiles?email=eq.${EMAIL}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{"role":"customer"}')
  echo "$RES" | jq -e '.[0]' &>/dev/null \
    && success "$EMAIL is now customer" \
    || error "User not found: $RES"
}

cmd_delete_user() {
  require_curl; require_jq; require_env
  local EMAIL="$1"
  [ -z "$EMAIL" ] && error "Usage: manage.sh delete-user <email>"
  warn "Deleting user: $EMAIL (this is irreversible)"
  # get uid first
  UID_VAL=$(curl -s \
    "${SUPABASE_URL}/rest/v1/profiles?email=eq.${EMAIL}&select=id" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '.[0].id')
  [ "$UID_VAL" = "null" ] || [ -z "$UID_VAL" ] && error "User not found: $EMAIL"
  # delete from auth.users via admin API
  curl -s -X DELETE \
    "${SUPABASE_URL}/auth/v1/admin/users/${UID_VAL}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" > /dev/null
  success "Deleted user $EMAIL ($UID_VAL)"
}

# ─────────────────────────────────────────────────────────────────────────────
#  MENU ITEMS
# ─────────────────────────────────────────────────────────────────────────────

cmd_list_menu() {
  require_curl; require_jq; require_env
  header "Menu Items"
  curl -s "${SUPABASE_URL}/rest/v1/menu_items?select=name,price,category,offer_percent,available&order=category.asc,name.asc" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '.[] | "\(.category)\t\(.name)\t$\(.price)\t\(.offer_percent)% off\t\(if .available then "✔" else "✖" end)"' \
    | column -t
  echo ""
}

cmd_add_item() {
  require_curl; require_jq; require_env
  # Interactive prompts
  read -p "Name: "          NAME
  read -p "Description: "   DESC
  read -p "Price (e.g. 12.99): " PRICE
  read -p "Category (Pizza/Burgers/Salads/Pasta/Drinks/Desserts): " CAT
  read -p "Image emoji or URL: " IMG
  read -p "Offer percent (0-99, default 0): " OFFER
  OFFER="${OFFER:-0}"
  PAYLOAD=$(jq -n \
    --arg name "$NAME" --arg desc "$DESC" --argjson price "$PRICE" \
    --arg cat "$CAT" --arg img "$IMG" --argjson offer "$OFFER" \
    '{name:$name,description:$desc,price:$price,category:$cat,image_url:$img,offer_percent:$offer,available:true}')
  RES=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/menu_items" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$PAYLOAD")
  echo "$RES" | jq -e '.[0].id' &>/dev/null \
    && success "Added: $NAME" \
    || error "Failed: $RES"
}

cmd_update_price() {
  require_curl; require_jq; require_env
  local NAME="$1"; local PRICE="$2"
  [ -z "$NAME" ] || [ -z "$PRICE" ] && error "Usage: manage.sh update-price \"Item Name\" 14.99"
  RES=$(curl -s -X PATCH \
    "${SUPABASE_URL}/rest/v1/menu_items?name=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('${NAME}'))")" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"price\":${PRICE}}")
  echo "$RES" | jq -e '.[0].id' &>/dev/null \
    && success "Updated price of \"$NAME\" to \$$PRICE" \
    || error "Item not found or update failed"
}

cmd_set_offer() {
  require_curl; require_jq; require_env
  local NAME="$1"; local PCT="$2"
  [ -z "$NAME" ] || [ -z "$PCT" ] && error "Usage: manage.sh set-offer \"Item Name\" 20"
  RES=$(curl -s -X PATCH \
    "${SUPABASE_URL}/rest/v1/menu_items?name=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('${NAME}'))")" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"offer_percent\":${PCT}}")
  echo "$RES" | jq -e '.[0].id' &>/dev/null \
    && success "Set ${PCT}% offer on \"$NAME\"" \
    || error "Item not found"
}

cmd_toggle_available() {
  require_curl; require_jq; require_env
  local NAME="$1"
  [ -z "$NAME" ] && error "Usage: manage.sh toggle-available \"Item Name\""
  # get current status
  CURRENT=$(curl -s \
    "${SUPABASE_URL}/rest/v1/menu_items?name=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('${NAME}'))")&select=available" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '.[0].available')
  [ "$CURRENT" = "null" ] && error "Item not found: $NAME"
  NEW="true"; [ "$CURRENT" = "true" ] && NEW="false"
  curl -s -X PATCH \
    "${SUPABASE_URL}/rest/v1/menu_items?name=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('${NAME}'))")" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"available\":${NEW}}" > /dev/null
  success "\"$NAME\" is now: $([ "$NEW" = "true" ] && echo 'AVAILABLE ✔' || echo 'UNAVAILABLE ✖')"
}

cmd_delete_item() {
  require_curl; require_jq; require_env
  local NAME="$1"
  [ -z "$NAME" ] && error "Usage: manage.sh delete-item \"Item Name\""
  warn "Deleting menu item: $NAME"
  curl -s -X DELETE \
    "${SUPABASE_URL}/rest/v1/menu_items?name=eq.$(python3 -c "import urllib.parse; print(urllib.parse.quote('${NAME}'))")" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" > /dev/null
  success "Deleted: $NAME"
}

# ─────────────────────────────────────────────────────────────────────────────
#  DATABASE
# ─────────────────────────────────────────────────────────────────────────────

cmd_db_push() {
  command -v supabase &>/dev/null || error "Supabase CLI not installed. Run: npm install -g supabase"
  info "Pushing migrations to remote Supabase..."
  supabase db push
  success "Database schema pushed."
}

cmd_db_reset() {
  command -v supabase &>/dev/null || error "Supabase CLI not installed."
  warn "This will RESET the local Supabase database!"
  read -p "Type 'yes' to confirm: " CONFIRM
  [ "$CONFIRM" != "yes" ] && { info "Cancelled."; exit 0; }
  supabase db reset
  success "Local DB reset with fresh migrations + seed data."
}

cmd_db_seed() {
  require_curl; require_jq; require_env
  info "Seeding menu items..."
  ITEMS='[
    {"name":"Margherita Pizza","description":"Classic tomato, mozzarella, basil","price":12.99,"category":"Pizza","image_url":"🍕","offer_percent":0},
    {"name":"Pepperoni Feast","description":"Double pepperoni, extra cheese","price":15.99,"category":"Pizza","image_url":"🍕","offer_percent":10},
    {"name":"BBQ Chicken Burger","description":"Smoky BBQ, crispy chicken","price":11.50,"category":"Burgers","image_url":"🍔","offer_percent":0},
    {"name":"Beef Smash Burger","description":"Double smash, cheddar, pickles","price":13.99,"category":"Burgers","image_url":"🍔","offer_percent":15},
    {"name":"Caesar Salad","description":"Romaine, croutons, parmesan","price":8.99,"category":"Salads","image_url":"🥗","offer_percent":0},
    {"name":"Spaghetti Carbonara","description":"Guanciale, pecorino, black pepper","price":14.00,"category":"Pasta","image_url":"🍝","offer_percent":0},
    {"name":"Mango Lassi","description":"Chilled mango yogurt drink","price":4.50,"category":"Drinks","image_url":"🥭","offer_percent":0},
    {"name":"Tiramisu","description":"Mascarpone, espresso, cocoa","price":6.50,"category":"Desserts","image_url":"🍮","offer_percent":0}
  ]'
  RES=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/menu_items" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$ITEMS")
  success "Seed data inserted."
}

# ─────────────────────────────────────────────────────────────────────────────
#  CART
# ─────────────────────────────────────────────────────────────────────────────

cmd_clear_all_carts() {
  require_curl; require_env
  warn "Clearing ALL cart items for ALL users"
  read -p "Type 'yes' to confirm: " CONFIRM
  [ "$CONFIRM" != "yes" ] && { info "Cancelled."; exit 0; }
  curl -s -X DELETE "${SUPABASE_URL}/rest/v1/cart_items?id=neq.00000000-0000-0000-0000-000000000000" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" > /dev/null
  success "All carts cleared."
}

# ─────────────────────────────────────────────────────────────────────────────
#  STATUS
# ─────────────────────────────────────────────────────────────────────────────

cmd_status() {
  require_curl; require_jq; require_env
  header "Project Status"
  USERS=$(curl -s "${SUPABASE_URL}/rest/v1/profiles?select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | grep -o '[0-9]*$' || echo "?")
  ITEMS=$(curl -s "${SUPABASE_URL}/rest/v1/menu_items?select=count" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: count=exact" -I 2>/dev/null | grep -i content-range | grep -o '[0-9]*$' || echo "?")
  ADMINS=$(curl -s "${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=email" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    | jq -r '[.[].email] | join(", ")' 2>/dev/null || echo "?")
  echo -e "  Supabase URL : ${CYAN}${SUPABASE_URL}${NC}"
  echo -e "  Users        : ${BOLD}${USERS}${NC}"
  echo -e "  Menu items   : ${BOLD}${ITEMS}${NC}"
  echo -e "  Admins       : ${CYAN}${ADMINS}${NC}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
#  HELP
# ─────────────────────────────────────────────────────────────────────────────

cmd_help() {
  echo -e "
${BOLD}${CYAN}La Maison — Terminal Management${NC}

${BOLD}Usage:${NC}  bash scripts/manage.sh <command> [args]

${BOLD}${YELLOW}👤 USER COMMANDS${NC}
  list-users                     List all users and their roles
  make-admin   <email>           Grant admin role to a user
  remove-admin <email>           Revoke admin role (back to customer)
  delete-user  <email>           Permanently delete a user

${BOLD}${YELLOW}🍽️  MENU COMMANDS${NC}
  list-menu                      List all menu items
  add-item                       Interactively add a new menu item
  update-price \"Name\" <price>    Change price of an item
  set-offer    \"Name\" <percent>  Set offer discount % (0 to remove)
  toggle-available \"Name\"        Toggle availability on/off
  delete-item  \"Name\"            Delete a menu item

${BOLD}${YELLOW}🗄️  DATABASE COMMANDS${NC}
  db-push                        Push migrations to remote Supabase
  db-reset                       Reset local dev database
  db-seed                        Insert default seed menu items

${BOLD}${YELLOW}🛒 CART COMMANDS${NC}
  clear-all-carts                Clear every cart (use with care)

${BOLD}${YELLOW}📊 OTHER${NC}
  status                         Show project stats
  help                           Show this help

${BOLD}⚙️  SETUP:${NC}
  Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.
  (Settings → API → service_role key in Supabase dashboard)
"
}

# ─────────────────────────────────────────────────────────────────────────────
#  ROUTER
# ─────────────────────────────────────────────────────────────────────────────

CMD="${1:-help}"; shift 2>/dev/null || true

case "$CMD" in
  list-users)        cmd_list_users ;;
  make-admin)        cmd_make_admin "$@" ;;
  remove-admin)      cmd_remove_admin "$@" ;;
  delete-user)       cmd_delete_user "$@" ;;
  list-menu)         cmd_list_menu ;;
  add-item)          cmd_add_item ;;
  update-price)      cmd_update_price "$@" ;;
  set-offer)         cmd_set_offer "$@" ;;
  toggle-available)  cmd_toggle_available "$@" ;;
  delete-item)       cmd_delete_item "$@" ;;
  db-push)           cmd_db_push ;;
  db-reset)          cmd_db_reset ;;
  db-seed)           cmd_db_seed ;;
  clear-all-carts)   cmd_clear_all_carts ;;
  status)            cmd_status ;;
  help|--help|-h)    cmd_help ;;
  *)                 error "Unknown command: $CMD. Run: bash scripts/manage.sh help" ;;
esac
