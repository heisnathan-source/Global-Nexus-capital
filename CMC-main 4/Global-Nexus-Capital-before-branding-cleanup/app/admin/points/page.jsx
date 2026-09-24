"use client";

import Link from "next/link";
import { useEffect, useState } from "react";


const EMPTY_FORM = {
  name: "",
  description: "",
  imageUrl: "",
  pointsRequired: ""
};


export default function PointsAdmin() {

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [items, setItems] =
    useState([]);

  const [purchases, setPurchases] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [editingItem, setEditingItem] =
    useState(null);

  const [editForm, setEditForm] =
    useState(EMPTY_FORM);

  const [purchaseEditing, setPurchaseEditing] =
    useState(null);

  const [giftOpen, setGiftOpen] =
    useState(false);

  const [giftSearch, setGiftSearch] =
    useState("");

  const [giftUsers, setGiftUsers] =
    useState([]);

  const [selectedGiftUser, setSelectedGiftUser] =
    useState(null);

  const [giftPoints, setGiftPoints] =
    useState("");

  const [giftDescription, setGiftDescription] =
    useState("");

  const [giftLoading, setGiftLoading] =
    useState(false);


  async function load() {

    try {

      setLoading(true);

      const response =
        await fetch(
          "/api/admin/points",
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to load Points Shop."
        );

      }

      setItems(result.items || []);

      setPurchases(
        result.purchases || []
      );

    } catch (e) {

      setError(
        e.message ||
        "Unable to load Points Shop."
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {
    load();
  }, []);


  function updateForm(key, value) {

    setForm((current) => ({
      ...current,
      [key]: value
    }));

  }


  function updateEditForm(key, value) {

    setEditForm((current) => ({
      ...current,
      [key]: value
    }));

  }


  async function uploadImage(file) {

    if (!file) return "";

    try {

      setUploading(true);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "folder",
        "points-shop"
      );

      const response =
        await fetch(
          "/api/admin/media",
          {
            method: "POST",
            credentials: "include",
            body: formData
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Image upload failed."
        );

      }

      return result.url;

    } catch (e) {

      setError(
        e.message ||
        "Image upload failed."
      );

      return "";

    } finally {

      setUploading(false);

    }

  }


  async function createItem() {

    try {

      setSaving(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/points",
          {
            method: "POST",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify(form)
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to create item."
        );

      }

      setMessage(
        "Points Shop item created successfully."
      );

      setForm(EMPTY_FORM);

      await load();

    } catch (e) {

      setError(
        e.message ||
        "Unable to create item."
      );

    } finally {

      setSaving(false);

    }

  }


  function openEditItem(item) {

    setEditingItem(item);

    setEditForm({

      name:
        item.name || "",

      description:
        item.description || "",

      imageUrl:
        item.image_url || "",

      pointsRequired:
        String(
          item.points_required || 0
        ),

      active:
        item.active === true

    });

  }


  function cancelEditItem() {

    setEditingItem(null);

    setEditForm(EMPTY_FORM);

  }


  async function saveItem() {

    if (!editingItem) return;

    try {

      setSaving(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/points",
          {
            method: "PATCH",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({

              action:
                "update-item",

              id:
                editingItem.id,

              ...editForm

            })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to update item."
        );

      }

      setMessage(
        "Points Shop item updated successfully."
      );

      cancelEditItem();

      await load();

    } catch (e) {

      setError(
        e.message ||
        "Unable to update item."
      );

    } finally {

      setSaving(false);

    }

  }


  async function deleteItem(item) {

    const confirmed =
      window.confirm(
        `Remove "${item.name}" from the Points Shop?`
      );

    if (!confirmed) return;

    try {

      setSaving(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/points",
          {
            method: "DELETE",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              id: item.id
            })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to remove item."
        );

      }

      setMessage(
        "Points Shop item removed."
      );

      await load();

    } catch (e) {

      setError(
        e.message ||
        "Unable to remove item."
      );

    } finally {

      setSaving(false);

    }

  }


  function openPurchase(purchase) {

    setPurchaseEditing({

      id:
        purchase.id,

      fulfillmentStatus:
        purchase.fulfillment_status ||
        "pending",

      fulfillmentNote:
        purchase.fulfillment_note ||
        "",

      itemName:
        purchase.item_name || "Reward",

      userName:
        purchase.user_name ||
        "Unknown user",

      userPhone:
        purchase.user_phone ||
        "",

      accountId:
        purchase.account_id ||
        ""

    });

  }


  function updatePurchase(key, value) {

    setPurchaseEditing((current) => ({
      ...current,
      [key]: value
    }));

  }


  async function savePurchase() {

    if (!purchaseEditing) return;

    try {

      setSaving(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/points",
          {
            method: "PATCH",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({

              action:
                "update-purchase",

              id:
                purchaseEditing.id,

              fulfillmentStatus:
                purchaseEditing.fulfillmentStatus,

              fulfillmentNote:
                purchaseEditing.fulfillmentNote

            })
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to update purchase."
        );

      }

      setMessage(
        "Purchase fulfillment updated successfully."
      );

      setPurchaseEditing(null);

      await load();

    } catch (e) {

      setError(
        e.message ||
        "Unable to update purchase."
      );

    } finally {

      setSaving(false);

    }

  }


  async function searchGiftUsers(search = "") {

    try {

      setGiftLoading(true);
      setError("");

      const response =
        await fetch(
          `/api/admin/points/gift?search=${encodeURIComponent(search)}`,
          {
            credentials: "include",
            cache: "no-store"
          }
        );

      const result =
        await response.json();

      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to search users."
        );

      }

      setGiftUsers(
        result.users || []
      );

    } catch (e) {

      setError(
        e.message ||
        "Unable to search users."
      );

    } finally {

      setGiftLoading(false);

    }

  }


  async function giftPointsToUser() {

    if (!selectedGiftUser) {

      setError(
        "Please select a user first."
      );

      return;

    }


    const amount =
      Math.trunc(
        Number(giftPoints)
      );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      setError(
        "Please enter a valid number of points."
      );

      return;

    }


    try {

      setGiftLoading(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/points/gift",
          {
            method: "POST",

            credentials: "include",

            headers: {
              "content-type":
                "application/json"
            },

            body: JSON.stringify({
              userId:
                selectedGiftUser.id,

              points:
                amount,

              description:
                giftDescription
            })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result?.error ||
          "Unable to gift points."
        );

      }


      setMessage(
        `${amount.toLocaleString()} points gifted to ${
          selectedGiftUser.name ||
          "user"
        } successfully.`
      );


      setSelectedGiftUser({
        ...selectedGiftUser,
        points_balance:
          result.newBalance
      });


      setGiftPoints("");

      setGiftDescription("");


      await searchGiftUsers(
        giftSearch
      );


    } catch (e) {

      setError(
        e.message ||
        "Unable to gift points."
      );

    } finally {

      setGiftLoading(false);

    }

  }


  function formatDate(date) {

    if (!date) return "";

    return new Date(date)
      .toLocaleString();

  }


  return (

    <main className="mobile-shell scroll-page">

      <header className="topbar">

        <div>

          <div className="eyebrow">
            GLOBAL NEXUS CAPITAL ADMIN
          </div>

          <h1>
            Points Shop
          </h1>

          <p className="muted">
            Create rewards and manage user redemptions.
          </p>

        </div>

        <Link
          className="icon-button"
          href="/admin"
        >
          ←
        </Link>

      </header>


      {message && (

        <section className="admin-card">

          <p className="auth-success">
            {message}
          </p>

        </section>

      )}


      {error && (

        <section className="admin-card">

          <p className="auth-error">
            {error}
          </p>

        </section>

      )}


      {/* ========================================= */}
      {/* GIFT POINTS */}
      {/* ========================================= */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            🎁 Gift Points
          </strong>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {

              const nextOpen = !giftOpen;

              setGiftOpen(nextOpen);

              if (nextOpen && giftUsers.length === 0) {

                searchGiftUsers("");

              }

            }}
          >

            {giftOpen ? "Close" : "Open"}

          </button>

        </div>


        {giftOpen && (

          <div className="form-card">


            {/* SEARCH */}

            <label>

              Search User

              <input
                value={giftSearch}
                onChange={(e) => {

                  const value = e.target.value;

                  setGiftSearch(value);

                }}
                placeholder="Name, phone or account ID"
              />

            </label>


            <button
              type="button"
              className="secondary-button"
              disabled={giftLoading}
              onClick={() =>
                searchGiftUsers(giftSearch)
              }
            >

              {giftLoading
                ? "Searching..."
                : "Search Users"}

            </button>


            {/* USER RESULTS */}

            {giftUsers.length > 0 && (

              <div className="gift-users-list">

                {giftUsers.map((user) => (

                  <button
                    type="button"
                    key={user.id}
                    className={
                      selectedGiftUser?.id === user.id
                        ? "gift-user selected"
                        : "gift-user"
                    }
                    onClick={() =>
                      setSelectedGiftUser(user)
                    }
                  >

                    <strong>
                      {user.name || "Unnamed User"}
                    </strong>


                    <span className="muted">

                      {user.phone ||
                        user.phone_number ||
                        "No phone"}

                    </span>


                    {user.account_id && (

                      <span className="muted">

                        ID: {user.account_id}

                      </span>

                    )}


                    <span className="badge">

                      {Number(
                        user.points_balance || 0
                      ).toLocaleString()} pts

                    </span>

                  </button>

                ))}

              </div>

            )}


            {selectedGiftUser && (

              <div className="gift-selected-user">

                <strong>
                  Selected:{" "}

                  {selectedGiftUser.name ||
                    "User"}

                </strong>


                <span className="muted">

                  Current balance:{" "}

                  {Number(
                    selectedGiftUser.points_balance || 0
                  ).toLocaleString()} pts

                </span>

              </div>

            )}


            {/* POINT AMOUNT */}

            <label>

              Points to Gift

              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={giftPoints}
                onChange={(e) =>
                  setGiftPoints(e.target.value)
                }
                placeholder="Enter points"
              />

            </label>


            {/* DESCRIPTION */}

            <label>

              Reason / Description (optional)

              <textarea
                value={giftDescription}
                onChange={(e) =>
                  setGiftDescription(e.target.value)
                }
                placeholder="Example: Testing Points Shop"
              />

            </label>


            <button
              type="button"
              className="primary-button"
              disabled={
                giftLoading ||
                !selectedGiftUser
              }
              onClick={giftPointsToUser}
            >

              {giftLoading
                ? "Processing..."
                : "Gift Points"}

            </button>


          </div>

        )}

      </section>


      {/* CREATE ITEM */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Create Points Shop Item
          </strong>

        </div>


        <div className="form-card">

          <label>

            Item name

            <input
              value={form.name}
              onChange={(e) =>
                updateForm(
                  "name",
                  e.target.value
                )
              }
              placeholder="Enter reward name"
            />

          </label>


          <label>

            Description

            <textarea
              value={form.description}
              onChange={(e) =>
                updateForm(
                  "description",
                  e.target.value
                )
              }
              placeholder="Describe this reward"
            />

          </label>


          <label>

            Reward Image (optional)

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploading}
              onChange={async (e) => {

                const selectedFile =
                  e.target.files?.[0];

                if (!selectedFile) return;

                const url =
                  await uploadImage(
                    selectedFile
                  );

                if (url) {

                  updateForm(
                    "imageUrl",
                    url
                  );

                  setMessage(
                    "Image uploaded successfully."
                  );

                }

              }}
            />

          </label>


          {uploading && (

            <p className="muted">

              Uploading image…

            </p>

          )}


          {form.imageUrl && (

            <img
              src={form.imageUrl}
              alt="Reward preview"
              className="points-shop-image"
            />

          )}


          <label>

            Points required

            <input
              inputMode="numeric"
              type="number"
              min="0"
              value={form.pointsRequired}
              onChange={(e) =>
                updateForm(
                  "pointsRequired",
                  e.target.value
                )
              }
              placeholder="Example: 500"
            />

          </label>


          <button
            type="button"
            className="primary-button"
            onClick={createItem}
            disabled={saving}
          >

            {saving
              ? "Saving…"
              : "Create Item"}

          </button>

        </div>

      </section>



      {/* SHOP ITEMS */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            Shop Items
          </strong>

          <span className="badge">
            {items.length}
          </span>

        </div>


        {loading ? (

          <div className="empty-document">

            Loading Points Shop…

          </div>

        ) : items.length === 0 ? (

          <div className="empty-document">

            No Points Shop items created yet.

          </div>

        ) : (

          <div className="points-admin-list">

            {items.map((item) => (

              <div
                className="points-admin-item"
                key={item.id}
              >

                {item.image_url && (

                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="points-admin-image"
                  />

                )}


                <div className="points-admin-content">

                  <div className="admin-card-head">

                    <strong>
                      {item.name}
                    </strong>

                    <span
                      className={
                        item.active
                          ? "status-on"
                          : "status-off"
                      }
                    >

                      {item.active
                        ? "ACTIVE"
                        : "OFF"}

                    </span>

                  </div>


                  {item.description && (

                    <p className="muted">

                      {item.description}

                    </p>

                  )}


                  <strong>

                    {Number(
                      item.points_required || 0
                    ).toLocaleString()} points

                  </strong>


                  <div className="points-admin-actions">

                    <button
                      type="button"
                      className="small-button"
                      onClick={() =>
                        openEditItem(item)
                      }
                    >
                      Edit
                    </button>


                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        deleteItem(item)
                      }
                      disabled={saving}
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>



      {/* USER PURCHASES */}

      <section className="admin-card">

        <div className="admin-card-head">

          <strong>
            User Redemptions
          </strong>

          <span className="badge">
            {purchases.length}
          </span>

        </div>


        {loading ? (

          <div className="empty-document">

            Loading redemptions…

          </div>

        ) : purchases.length === 0 ? (

          <div className="empty-document">

            No user redemptions yet.

          </div>

        ) : (

          <div className="points-purchase-list">

            {purchases.map((purchase) => (

              <button
                type="button"
                className="points-purchase-item"
                key={purchase.id}
                onClick={() =>
                  openPurchase(purchase)
                }
              >

                <div>

                  <strong>
                    {purchase.item_name}
                  </strong>

                  <span className="muted">

                    {purchase.user_name ||
                      "Unknown user"}

                  </span>

                </div>


                <span
                  className="badge"
                >

                  {purchase.fulfillment_status}

                </span>


                <span className="muted">

                  {Number(
                    purchase.points_spent || 0
                  ).toLocaleString()} pts

                </span>


                <span className="muted">

                  {formatDate(
                    purchase.created_at
                  )}

                </span>

              </button>

            ))}

          </div>

        )}

      </section>



      {/* EDIT ITEM MODAL */}

      {editingItem && (

        <div className="points-modal-backdrop">

          <section className="points-modal">

            <h2>
              Edit Shop Item
            </h2>


            <div className="form-card">

              <label>

                Item name

                <input
                  value={editForm.name}
                  onChange={(e) =>
                    updateEditForm(
                      "name",
                      e.target.value
                    )
                  }
                />

              </label>


              <label>

                Description

                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    updateEditForm(
                      "description",
                      e.target.value
                    )
                  }
                />

              </label>


              <label>

                Replace Reward Image (optional)

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploading}
                  onChange={async (e) => {

                    const selectedFile =
                      e.target.files?.[0];

                    if (!selectedFile) return;

                    const url =
                      await uploadImage(
                        selectedFile
                      );

                    if (url) {

                      updateEditForm(
                        "imageUrl",
                        url
                      );

                      setMessage(
                        "New image uploaded successfully."
                      );

                    }

                  }}
                />

              </label>


              {uploading && (

                <p className="muted">

                  Uploading image…

                </p>

              )}


              {editForm.imageUrl && (

                <img
                  src={editForm.imageUrl}
                  alt="Reward preview"
                  className="points-shop-image"
                />

              )}


              <label>

                Points required

                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={
                    editForm.pointsRequired
                  }
                  onChange={(e) =>
                    updateEditForm(
                      "pointsRequired",
                      e.target.value
                    )
                  }
                />

              </label>


              <label className="setting-row">

                <span>
                  Item available to users
                </span>

                <button
                  type="button"
                  className={
                    editForm.active
                      ? "status-on"
                      : "status-off"
                  }
                  onClick={() =>
                    updateEditForm(
                      "active",
                      !editForm.active
                    )
                  }
                >

                  {editForm.active
                    ? "ON"
                    : "OFF"}

                </button>

              </label>


              <div className="points-modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditItem}
                >
                  Cancel
                </button>


                <button
                  type="button"
                  className="primary-button"
                  onClick={saveItem}
                  disabled={saving}
                >

                  {saving
                    ? "Saving…"
                    : "Save Changes"}

                </button>

              </div>

            </div>

          </section>

        </div>

      )}



      {/* PURCHASE FULFILLMENT MODAL */}

      {purchaseEditing && (

        <div className="points-modal-backdrop">

          <section className="points-modal">

            <h2>
              Redemption Details
            </h2>


            <div className="admin-card">

              <strong>
                {purchaseEditing.itemName}
              </strong>

              <p className="muted">

                User:
                {" "}
                {purchaseEditing.userName}

              </p>


              {purchaseEditing.userPhone && (

                <p className="muted">

                  Phone:
                  {" "}
                  {purchaseEditing.userPhone}

                </p>

              )}


              {purchaseEditing.accountId && (

                <p className="muted">

                  Account ID:
                  {" "}
                  {purchaseEditing.accountId}

                </p>

              )}

            </div>


            <div className="form-card">

              <label>

                Fulfillment status

                <select
                  value={
                    purchaseEditing.fulfillmentStatus
                  }
                  onChange={(e) =>
                    updatePurchase(
                      "fulfillmentStatus",
                      e.target.value
                    )
                  }
                >

                  <option value="pending">
                    Pending
                  </option>

                  <option value="contacted">
                    Contacted
                  </option>

                  <option value="processing">
                    Processing
                  </option>

                  <option value="fulfilled">
                    Fulfilled
                  </option>

                </select>

              </label>


              <label>

                Admin note

                <textarea
                  value={
                    purchaseEditing.fulfillmentNote
                  }
                  onChange={(e) =>
                    updatePurchase(
                      "fulfillmentNote",
                      e.target.value
                    )
                  }
                  placeholder="Add fulfillment information..."
                />

              </label>


              <div className="points-modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setPurchaseEditing(null)
                  }
                >
                  Close
                </button>


                <button
                  type="button"
                  className="primary-button"
                  onClick={savePurchase}
                  disabled={saving}
                >

                  {saving
                    ? "Saving…"
                    : "Save Status"}

                </button>

              </div>

            </div>

          </section>

        </div>

      )}

    </main>

  );

}
