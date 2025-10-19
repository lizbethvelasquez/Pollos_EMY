import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
// --- Google Apps Script Backend Configuration ---
// IMPORTANTE: Reemplaza esta URL con la URL de tu Web App desplegada desde Google Apps Script.
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwR2NRc4qGBkRnP0prtGfRg_dAKyz8p1eGnf9cRfZ0RutsFlAdSJ01GCZwRQ_ne4UEptA/exec';
/**
 * Función central para comunicarse con el backend de Google Apps Script.
 * @param {string} action - El nombre de la función a ejecutar en el script.
 * @param {object} payload - Los datos a enviar a la función.
 * @returns {Promise<any>} La respuesta del script.
 */
async function callGoogleScript(action, payload = {}) {
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // Apps Script works well with text/plain
            },
            body: JSON.stringify({ action, payload }),
            redirect: 'follow'
        });
        const responseText = await res.text();
        if (!res.ok) {
            // If status is not 2xx, the response body contains the error.
            // It could be plain text or a snippet of an HTML error page from Apps Script.
            // We throw this as the primary error message.
            throw new Error(`Error del servidor (${res.status}): ${responseText}`);
        }
        // If we get here, the response was OK (2xx), so we expect valid JSON.
        let result;
        try {
            result = JSON.parse(responseText);
        }
        catch (error) {
            // This case is rare: server returned 200 OK but with non-JSON body.
            console.error("Respuesta inesperada del servidor (no es JSON):", responseText);
            throw new Error("Se recibió una respuesta inválida del servidor.");
        }
        if (result.success) {
            return result; // Devuelve el objeto completo: { success: true, data: ..., message: ... }
        }
        else {
            // The script executed but the operation failed (e.g., login incorrecto).
            // The script provides a specific error message.
            throw new Error(result.message || 'Ocurrió un error desconocido en el script.');
        }
    }
    catch (error) {
        // This catches network errors (fetch fails), or any errors thrown above.
        console.error('Error en callGoogleScript:', { action, payload, originalError: error });
        // Re-throw the original error so the component can access its message property.
        throw error;
    }
}
// --- Helper functions to interact with Google Sheets API ---
const confirmSaleImmediatelyInDatabase = (saleData) => {
    return callGoogleScript('addSale', { saleData });
};
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};
const saveQrCodeToDatabase = (base64Image) => {
    return callGoogleScript('saveQrConfig', { qrImageUrl: base64Image });
};
const getQrCodeFromDatabase = () => {
    return callGoogleScript('getQrConfig');
};
const requestPurchaseInDatabase = (saleData) => {
    return callGoogleScript('addPendingSale', { saleData });
};
// Notification API Helpers
const createNotificationInDatabase = (userId, message) => {
    return callGoogleScript('addNotification', { userId, message });
};
const getUnreadNotificationsForUserFromDatabase = (userId) => {
    return callGoogleScript('getUnreadNotifications', { userId });
};
const markUserNotificationsAsReadInDatabase = (userId) => {
    return callGoogleScript('markNotificationsRead', { userId });
};
const approvePendingSale = (pendingSaleId) => {
    return callGoogleScript('approvePendingSale', { id: pendingSaleId });
};
const rejectPendingSale = (pendingSaleId) => {
    return callGoogleScript('rejectPendingSale', { id: pendingSaleId });
};
const getPendingSalesFromDatabase = () => {
    return callGoogleScript('getPendingSales');
};
const getUserPendingSalesFromDatabase = (userId) => {
    return callGoogleScript('getUserPendingSales', { userId });
};
const saveUserToDatabase = (userData) => {
    return callGoogleScript('addUser', { userData });
};
const saveAdminToDatabase = (adminData) => {
    return callGoogleScript('addAdmin', { adminData });
};
const saveMenuItemToDatabase = (menuItemData) => {
    return callGoogleScript('addMenuItem', { menuItemData });
};
const checkAdminCredentials = ({ adminUser, adminPass }) => {
    return callGoogleScript('checkAdminLogin', { adminUser, adminPass });
};
const checkUserCredentials = ({ user, pass }) => {
    return callGoogleScript('checkUserLogin', { user, pass });
};
// Admin API
const getAdmins = () => {
    return callGoogleScript('getAdmins');
};
const deleteAdminFromDatabase = (adminId) => {
    return callGoogleScript('deleteAdmin', { id: adminId });
};
const updateAdminInDatabase = (updatedAdminData) => {
    return callGoogleScript('updateAdmin', { updatedAdminData });
};
// User API
const getUsers = () => {
    return callGoogleScript('getUsers');
};
const deleteUserFromDatabase = (userId) => {
    return callGoogleScript('deleteUser', { id: userId });
};
const updateUserInDatabase = (updatedUserData) => {
    return callGoogleScript('updateUser', { updatedUserData });
};
// Menu API
const getMenuItemsFromDatabase = () => {
    return callGoogleScript('getMenuItems');
};
const deleteMenuItemFromDatabase = (itemId) => {
    return callGoogleScript('deleteMenuItem', { id: itemId });
};
const updateMenuItemInDatabase = (updatedItemData) => {
    return callGoogleScript('updateMenuItem', { updatedItemData });
};
// Sales API
const getSalesFromDatabase = () => {
    return callGoogleScript('getSales');
};
// --- Reusable UI Components ---
const ConnectionStatusToast = ({ message, type, isVisible }) => {
    return (React.createElement("div", { className: `connection-toast ${type} ${isVisible ? 'visible' : ''}` }, message));
};
const ErrorDisplay = ({ message, onRetry }) => (React.createElement("div", { className: "error-display-container" },
    React.createElement("div", { className: "submission-message error" }, message),
    React.createElement("button", { onClick: onRetry, className: "submit-button retry-button" }, "Reintentar")));
// New User Form Component
const NewUserForm = ({ onBack }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmissionStatus(null);
        setSubmissionMessage('');
        const formData = new FormData(event.target);
        const userData = Object.fromEntries(formData.entries());
        try {
            const response = await saveUserToDatabase(userData);
            setSubmissionStatus('success');
            setSubmissionMessage(response.message);
            setTimeout(() => onBack(), 2000);
        }
        catch (error) {
            setSubmissionStatus('error');
            setSubmissionMessage(error instanceof Error ? error.message : "Error al registrar. Por favor, inténtelo de nuevo.");
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "form-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Registrar Nuevo Usuario")),
        React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
            React.createElement("fieldset", { disabled: isSubmitting },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "nombres" }, "Nombres"),
                    React.createElement("input", { type: "text", id: "nombres", name: "nombres", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apellidos" }, "Apellidos"),
                    React.createElement("input", { type: "text", id: "apellidos", name: "apellidos", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "ci" }, "CI"),
                    React.createElement("input", { type: "text", id: "ci", name: "ci", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "usuario" }, "Usuario"),
                    React.createElement("input", { type: "text", id: "usuario", name: "usuario", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "contrasena" }, "Contrase\u00F1a"),
                    React.createElement("input", { type: "password", id: "contrasena", name: "contrasena", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "celular" }, "Celular"),
                    React.createElement("input", { type: "tel", id: "celular", name: "celular", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "direccion" }, "Direcci\u00F3n"),
                    React.createElement("input", { type: "text", id: "direccion", name: "direccion", required: true }))),
            submissionStatus && React.createElement("div", { className: `submission-message ${submissionStatus}` }, submissionMessage),
            React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "spinner" }),
                React.createElement("span", null, "Registrando..."))) : ('Registrar')))));
};
// Admin Login Form Component
const AdminLoginForm = ({ onBack, onLoginSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');
        const formData = new FormData(event.target);
        const adminUser = formData.get('admin-user');
        const adminPass = formData.get('admin-pass');
        try {
            const response = await checkAdminCredentials({ adminUser, adminPass });
            onLoginSuccess(response.data);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Error desconocido. Inténtelo de nuevo.");
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "form-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Iniciar Sesi\u00F3n")),
        React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
            React.createElement("fieldset", { disabled: isSubmitting },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "admin-user" }, "Administrador"),
                    React.createElement("input", { type: "text", id: "admin-user", name: "admin-user", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "admin-pass" }, "Contrase\u00F1a"),
                    React.createElement("input", { type: "password", id: "admin-pass", name: "admin-pass", required: true }))),
            errorMessage && React.createElement("div", { className: "submission-message error" }, errorMessage),
            React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "spinner" }),
                React.createElement("span", null, "Ingresando..."))) : ('Ingresar')))));
};
// User Login Form Component
const UserLoginForm = ({ onBack, onLoginSuccess }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');
        const formData = new FormData(event.target);
        const user = formData.get('user');
        const pass = formData.get('pass');
        try {
            const response = await checkUserCredentials({ user, pass });
            onLoginSuccess(response.data);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Error desconocido. Inténtelo de nuevo.");
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "form-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Iniciar Sesi\u00F3n")),
        React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
            React.createElement("fieldset", { disabled: isSubmitting },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "user" }, "Usuario"),
                    React.createElement("input", { type: "text", id: "user", name: "user", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "pass" }, "Contrase\u00F1a"),
                    React.createElement("input", { type: "password", id: "pass", name: "pass", required: true }))),
            errorMessage && React.createElement("div", { className: "submission-message error" }, errorMessage),
            React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "spinner" }),
                React.createElement("span", null, "Guardando..."))) : ('Guardar')))));
};
// Edit Admin Form Component (in a modal)
const EditAdminForm = ({ admin, onSave, onCancel }) => {
    const [formData, setFormData] = useState(admin);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => (Object.assign(Object.assign({}, prev), { [name]: value })));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSave(formData);
        setIsSubmitting(false);
    };
    return (React.createElement("div", { className: "modal-overlay" },
        React.createElement("div", { className: "modal-content" },
            React.createElement("h2", { className: "main-title" }, "Editar Admin"),
            React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
                React.createElement("fieldset", { disabled: isSubmitting },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "nombres" }, "Nombres"),
                        React.createElement("input", { type: "text", id: "nombres", name: "nombres", value: formData.nombres, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "apellido" }, "Apellidos"),
                        React.createElement("input", { type: "text", id: "apellido", name: "apellido", value: formData.apellido, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "ci" }, "CI"),
                        React.createElement("input", { type: "text", id: "ci", name: "ci", value: formData.ci, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "administrador" }, "Usuario"),
                        React.createElement("input", { type: "text", id: "administrador", name: "administrador", value: formData.administrador, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "telefono" }, "Celular"),
                        React.createElement("input", { type: "tel", id: "telefono", name: "telefono", value: formData.telefono, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "direccion" }, "Direcci\u00F3n"),
                        React.createElement("input", { type: "text", id: "direccion", name: "direccion", value: formData.direccion, onChange: handleChange, required: true }))),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", onClick: onCancel, className: "submit-button cancel-button", disabled: isSubmitting }, "Cancelar"),
                    React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "spinner" }),
                        React.createElement("span", null, "Guardando...")) : 'Guardar Cambios'))))));
};
// Edit User Form Component (in a modal)
const EditUserForm = ({ user, onSave, onCancel }) => {
    const [formData, setFormData] = useState(user);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => (Object.assign(Object.assign({}, prev), { [name]: value })));
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSave(formData);
        setIsSubmitting(false);
    };
    return (React.createElement("div", { className: "modal-overlay" },
        React.createElement("div", { className: "modal-content" },
            React.createElement("h2", { className: "main-title" }, "Editar Usuario"),
            React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
                React.createElement("fieldset", { disabled: isSubmitting },
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "nombres" }, "Nombres"),
                        React.createElement("input", { type: "text", id: "nombres", name: "nombres", value: formData.nombres, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "apellidos" }, "Apellidos"),
                        React.createElement("input", { type: "text", id: "apellidos", name: "apellidos", value: formData.apellidos, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "ci" }, "CI"),
                        React.createElement("input", { type: "text", id: "ci", name: "ci", value: formData.ci, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "usuario" }, "Usuario"),
                        React.createElement("input", { type: "text", id: "usuario", name: "usuario", value: formData.usuario, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "celular" }, "Celular"),
                        React.createElement("input", { type: "tel", id: "celular", name: "celular", value: formData.celular, onChange: handleChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "direccion" }, "Direcci\u00F3n"),
                        React.createElement("input", { type: "text", id: "direccion", name: "direccion", value: formData.direccion, onChange: handleChange, required: true }))),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", onClick: onCancel, className: "submit-button cancel-button", disabled: isSubmitting }, "Cancelar"),
                    React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "spinner" }),
                        React.createElement("span", null, "Guardando...")) : 'Guardar Cambios'))))));
};
// Edit Menu Item Form Component (in a modal)
const EditMenuItemForm = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newImageFile, setNewImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(item.imageUrl);
    const handleTextChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => (Object.assign(Object.assign({}, prev), { [name]: value })));
    };
    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewImageFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const finalData = Object.assign({}, formData);
        if (newImageFile) {
            finalData.imageUrl = await fileToBase64(newImageFile);
        }
        await onSave(finalData);
        setIsSubmitting(false);
    };
    return (React.createElement("div", { className: "modal-overlay" },
        React.createElement("div", { className: "modal-content" },
            React.createElement("h2", { className: "main-title" }, "Editar Men\u00FA"),
            React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
                React.createElement("fieldset", { disabled: isSubmitting },
                    React.createElement("div", { className: "form-group image-preview-group" },
                        React.createElement("label", { htmlFor: "imagen-edit" }, "Imagen del producto"),
                        imagePreview && React.createElement("img", { src: imagePreview, alt: "Vista previa del producto", className: "image-preview" }),
                        React.createElement("input", { type: "file", id: "imagen-edit", name: "imagen", accept: "image/*", onChange: handleImageChange })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "nombre" }, "Nombre del plato"),
                        React.createElement("input", { type: "text", id: "nombre", name: "nombre", value: formData.nombre, onChange: handleTextChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "descripcion" }, "Descripci\u00F3n breve"),
                        React.createElement("textarea", { id: "descripcion", name: "descripcion", rows: 3, value: formData.descripcion, onChange: handleTextChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "categoria" }, "Categor\u00EDa"),
                        React.createElement("select", { id: "categoria", name: "categoria", value: formData.categoria, onChange: handleTextChange, required: true },
                            React.createElement("option", { value: "" }, "Seleccione una categor\u00EDa"),
                            React.createElement("option", { value: "pollo economico" }, "Pollo Econ\u00F3mico"),
                            React.createElement("option", { value: "1/4 de pollo" }, "1/4 de Pollo"),
                            React.createElement("option", { value: "1/2 de pollo" }, "1/2 de Pollo"),
                            React.createElement("option", { value: "pollo completo" }, "Pollo Completo"))),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "precio" }, "Precio (Bs.)"),
                        React.createElement("input", { type: "number", id: "precio", name: "precio", min: "0", step: "0.50", value: formData.precio, onChange: handleTextChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "cantidad" }, "Cantidad"),
                        React.createElement("input", { type: "number", id: "cantidad", name: "cantidad", min: "0", value: formData.cantidad, onChange: handleTextChange, required: true })),
                    React.createElement("div", { className: "form-group" },
                        React.createElement("label", { htmlFor: "disponible" }, "Disponible"),
                        React.createElement("select", { id: "disponible", name: "disponible", value: formData.disponible, onChange: handleTextChange, required: true },
                            React.createElement("option", { value: "Si" }, "S\u00ED"),
                            React.createElement("option", { value: "No" }, "No")))),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", onClick: onCancel, className: "submit-button cancel-button", disabled: isSubmitting }, "Cancelar"),
                    React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "spinner" }),
                        React.createElement("span", null, "Guardando...")) : 'Guardar Cambios'))))));
};
// Confirm Delete Modal Component
const ConfirmDeleteModal = ({ name, onConfirm, onCancel, isDeleting }) => {
    return (React.createElement("div", { className: "modal-overlay" },
        React.createElement("div", { className: "modal-content confirm-modal" },
            React.createElement("h3", null, "Confirmar Eliminaci\u00F3n"),
            React.createElement("p", null,
                "\u00BFEst\u00E1 seguro de que desea eliminar ",
                React.createElement("strong", null, name),
                "?"),
            React.createElement("div", { className: "modal-actions" },
                React.createElement("button", { onClick: onCancel, className: "submit-button cancel-button", disabled: isDeleting }, "No"),
                React.createElement("button", { onClick: onConfirm, className: "submit-button delete-confirm-button", disabled: isDeleting }, isDeleting ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "spinner" }),
                    React.createElement("span", null, "Eliminando...")) : 'Sí')))));
};
const UserIcon = () => (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
    React.createElement("circle", { cx: "12", cy: "7", r: "4" })));
// AddAdminForm Component
const AddAdminForm = ({ onBack, onAdminAdded }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmissionStatus(null);
        setSubmissionMessage('');
        const formData = new FormData(event.target);
        const adminData = Object.fromEntries(formData.entries());
        try {
            const response = await saveAdminToDatabase(adminData);
            setSubmissionStatus('success');
            setSubmissionMessage(response.message);
            setTimeout(() => onAdminAdded(response.data), 1500);
        }
        catch (error) {
            setSubmissionStatus('error');
            setSubmissionMessage(error instanceof Error ? error.message : "Error al registrar. Por favor, inténtelo de nuevo.");
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "form-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Registrar Nuevo Admin")),
        React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
            React.createElement("fieldset", { disabled: isSubmitting },
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "nombres" }, "Nombres"),
                    React.createElement("input", { type: "text", id: "nombres", name: "nombres", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "apellido" }, "Apellido"),
                    React.createElement("input", { type: "text", id: "apellido", name: "apellido", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "ci" }, "CI"),
                    React.createElement("input", { type: "text", id: "ci", name: "ci", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "administrador" }, "Usuario"),
                    React.createElement("input", { type: "text", id: "administrador", name: "administrador", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "contrasena" }, "Contrase\u00F1a"),
                    React.createElement("input", { type: "password", id: "contrasena", name: "contrasena", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "telefono" }, "Tel\u00E9fono"),
                    React.createElement("input", { type: "tel", id: "telefono", name: "telefono", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "direccion" }, "Direcci\u00F3n"),
                    React.createElement("input", { type: "text", id: "direccion", name: "direccion", required: true }))),
            submissionStatus && React.createElement("div", { className: `submission-message ${submissionStatus}` }, submissionMessage),
            React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "spinner" }),
                React.createElement("span", null, "Registrando..."))) : ('Registrar')))));
};
// Manage Admins Component
const ManageAdminsView = ({ onBack }) => {
    const [admins, setAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [adminToDelete, setAdminToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAddingAdmin, setIsAddingAdmin] = useState(false);
    const fetchAdmins = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getAdmins();
            setAdmins(response.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar los administradores.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);
    const handleConfirmDelete = async () => {
        if (!adminToDelete)
            return;
        setIsDeleting(true);
        try {
            await deleteAdminFromDatabase(adminToDelete.id);
            setAdmins(prevAdmins => prevAdmins.filter(admin => admin.id !== adminToDelete.id));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setIsDeleting(false);
            setAdminToDelete(null); // Close modal
        }
    };
    const handleSaveEdit = async (updatedAdmin) => {
        try {
            await updateAdminInDatabase(updatedAdmin);
            setAdmins(prevAdmins => prevAdmins.map(admin => admin.id === updatedAdmin.id ? updatedAdmin : admin));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setEditingAdmin(null); // Close modal
        }
    };
    const handleAdminAdded = (newAdmin) => {
        setAdmins(prev => [...prev, newAdmin]);
        setIsAddingAdmin(false);
    };
    if (isAddingAdmin) {
        return React.createElement(AddAdminForm, { onBack: () => setIsAddingAdmin(false), onAdminAdded: handleAdminAdded });
    }
    return (React.createElement("div", { className: "manage-admins-view" },
        editingAdmin && React.createElement(EditAdminForm, { admin: editingAdmin, onSave: handleSaveEdit, onCancel: () => setEditingAdmin(null) }),
        adminToDelete && (React.createElement(ConfirmDeleteModal, { name: `${adminToDelete.nombres} ${adminToDelete.apellido}`, onConfirm: handleConfirmDelete, onCancel: () => setAdminToDelete(null), isDeleting: isDeleting })),
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Gestionar Admins"),
            React.createElement("button", { onClick: () => setIsAddingAdmin(true), className: "header-action-button", "aria-label": "A\u00F1adir administrador" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })))),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando administradores...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchAdmins }),
        !isLoading && !error && admins.length === 0 && React.createElement("p", { className: "no-admins-message" }, "No hay administradores registrados."),
        !isLoading && !error && admins.length > 0 && (React.createElement("div", { className: "data-list-container" }, admins.map(admin => (React.createElement("div", { key: admin.id, className: "data-card" },
            React.createElement("div", { className: "data-card-avatar" },
                React.createElement(UserIcon, null)),
            React.createElement("div", { className: "data-card-content" },
                React.createElement("div", { className: "data-card-info" },
                    React.createElement("h4", null,
                        admin.nombres,
                        " ",
                        admin.apellido),
                    React.createElement("div", { className: "info-grid" },
                        React.createElement("p", null,
                            React.createElement("strong", null, "Usuario:"),
                            " ",
                            admin.administrador),
                        React.createElement("p", null,
                            React.createElement("strong", null, "CI:"),
                            " ",
                            admin.ci),
                        React.createElement("p", null,
                            React.createElement("strong", null, "Tel\u00E9fono:"),
                            " ",
                            admin.telefono),
                        React.createElement("p", null,
                            React.createElement("strong", null, "Direcci\u00F3n:"),
                            " ",
                            admin.direccion)))),
            React.createElement("div", { className: "data-card-actions" },
                React.createElement("button", { className: "action-button edit-button", onClick: () => setEditingAdmin(admin) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                        React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
                    React.createElement("span", null, "Editar")),
                React.createElement("button", { className: "action-button delete-button", onClick: () => setAdminToDelete(admin) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("polyline", { points: "3 6 5 6 21 6" }),
                        React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                        React.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                        React.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" })),
                    React.createElement("span", null, "Eliminar"))))))))));
};
// Manage Users Component
const ManageUsersView = ({ onBack }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getUsers();
            setUsers(response.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar los usuarios.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);
    const handleConfirmDelete = async () => {
        if (!userToDelete)
            return;
        setIsDeleting(true);
        try {
            await deleteUserFromDatabase(userToDelete.id);
            setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setIsDeleting(false);
            setUserToDelete(null); // Close modal
        }
    };
    const handleSaveEdit = async (updatedUser) => {
        try {
            await updateUserInDatabase(updatedUser);
            setUsers(prevUsers => prevUsers.map(user => user.id === updatedUser.id ? updatedUser : user));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setEditingUser(null); // Close modal
        }
    };
    return (React.createElement("div", { className: "manage-users-view" },
        editingUser && React.createElement(EditUserForm, { user: editingUser, onSave: handleSaveEdit, onCancel: () => setEditingUser(null) }),
        userToDelete && (React.createElement(ConfirmDeleteModal, { name: `${userToDelete.nombres} ${userToDelete.apellidos}`, onConfirm: handleConfirmDelete, onCancel: () => setUserToDelete(null), isDeleting: isDeleting })),
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Gestionar Usuarios")),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando usuarios...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchUsers }),
        !isLoading && !error && users.length === 0 && React.createElement("p", { className: "no-admins-message" }, "No hay usuarios registrados."),
        !isLoading && !error && users.length > 0 && (React.createElement("div", { className: "data-list-container" }, users.map(user => (React.createElement("div", { key: user.id, className: "data-card" },
            React.createElement("div", { className: "data-card-avatar" },
                React.createElement(UserIcon, null)),
            React.createElement("div", { className: "data-card-content" },
                React.createElement("div", { className: "data-card-info" },
                    React.createElement("h4", null,
                        user.nombres,
                        " ",
                        user.apellidos),
                    React.createElement("div", { className: "info-grid" },
                        React.createElement("p", null,
                            React.createElement("strong", null, "Usuario:"),
                            " ",
                            user.usuario),
                        React.createElement("p", null,
                            React.createElement("strong", null, "CI:"),
                            " ",
                            user.ci),
                        React.createElement("p", null,
                            React.createElement("strong", null, "Celular:"),
                            " ",
                            user.celular),
                        React.createElement("p", null,
                            React.createElement("strong", null, "Direcci\u00F3n:"),
                            " ",
                            user.direccion)))),
            React.createElement("div", { className: "data-card-actions" },
                React.createElement("button", { className: "action-button edit-button", onClick: () => setEditingUser(user) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                        React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
                    React.createElement("span", null, "Editar")),
                React.createElement("button", { className: "action-button delete-button", onClick: () => setUserToDelete(user) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("polyline", { points: "3 6 5 6 21 6" }),
                        React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                        React.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                        React.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" })),
                    React.createElement("span", null, "Eliminar"))))))))));
};
// Add Menu Item Form
const AddMenuFormView = ({ onBack }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setSubmissionStatus('error');
            setSubmissionMessage("Por favor, seleccione una imagen para el producto.");
            return;
        }
        setIsSubmitting(true);
        setSubmissionStatus(null);
        setSubmissionMessage('');
        const formData = new FormData(event.target);
        const menuItemData = Object.fromEntries(formData.entries());
        try {
            menuItemData.imageUrl = await fileToBase64(selectedFile);
            const response = await saveMenuItemToDatabase(menuItemData);
            setSubmissionStatus('success');
            setSubmissionMessage(response.message);
            event.target.reset(); // Clear form on success
            setImagePreview(null);
            setSelectedFile(null);
            setTimeout(() => {
                setSubmissionStatus(null);
            }, 2500);
        }
        catch (error) {
            setSubmissionStatus('error');
            setSubmissionMessage(error instanceof Error ? error.message : "Error desconocido. Inténtelo de nuevo.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "form-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "A\u00F1adir Men\u00FA")),
        React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
            React.createElement("fieldset", { disabled: isSubmitting },
                React.createElement("div", { className: "form-group image-preview-group" },
                    React.createElement("label", { htmlFor: "imagen-add" }, "Imagen del producto"),
                    imagePreview && React.createElement("img", { src: imagePreview, alt: "Vista previa del producto", className: "image-preview" }),
                    React.createElement("input", { type: "file", id: "imagen-add", name: "imagen", accept: "image/*", required: true, onChange: handleImageChange })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "nombre" }, "Nombre del plato"),
                    React.createElement("input", { type: "text", id: "nombre", name: "nombre", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "descripcion" }, "Descripci\u00F3n breve"),
                    React.createElement("textarea", { id: "descripcion", name: "descripcion", rows: 3, required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "categoria" }, "Categor\u00EDa"),
                    React.createElement("select", { id: "categoria", name: "categoria", required: true },
                        React.createElement("option", { value: "" }, "Seleccione una categor\u00EDa"),
                        React.createElement("option", { value: "pollo economico" }, "Pollo Econ\u00F3mico"),
                        React.createElement("option", { value: "1/4 de pollo" }, "1/4 de Pollo"),
                        React.createElement("option", { value: "1/2 de pollo" }, "1/2 de Pollo"),
                        React.createElement("option", { value: "pollo completo" }, "Pollo Completo"))),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "precio" }, "Precio (Bs.)"),
                    React.createElement("input", { type: "number", id: "precio", name: "precio", min: "0", step: "0.50", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "cantidad" }, "Cantidad"),
                    React.createElement("input", { type: "number", id: "cantidad", name: "cantidad", min: "0", required: true })),
                React.createElement("div", { className: "form-group" },
                    React.createElement("label", { htmlFor: "disponible" }, "Disponible"),
                    React.createElement("select", { id: "disponible", name: "disponible", required: true },
                        React.createElement("option", { value: "Si" }, "S\u00ED"),
                        React.createElement("option", { value: "No" }, "No")))),
            submissionStatus && React.createElement("div", { className: `submission-message ${submissionStatus}` }, submissionMessage),
            React.createElement("button", { type: "submit", className: "submit-button", disabled: isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "spinner" }),
                React.createElement("span", null, "Registrando..."))) : ('Registrar')))));
};
// Menu View Component
const MenuView = ({ onBack, onAddMenuItem }) => {
    const [menuItems, setMenuItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getMenuItemsFromDatabase();
            setMenuItems(response.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar el menú.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchItems();
    }, [fetchItems]);
    const handleConfirmDelete = async () => {
        if (!itemToDelete)
            return;
        setIsDeleting(true);
        try {
            await deleteMenuItemFromDatabase(itemToDelete.id);
            setMenuItems(prevItems => prevItems.filter(item => item.id !== itemToDelete.id));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setIsDeleting(false);
            setItemToDelete(null);
        }
    };
    const handleSaveEdit = async (updatedItem) => {
        try {
            await updateMenuItemInDatabase(updatedItem);
            setMenuItems(prevItems => prevItems.map(item => item.id === updatedItem.id ? updatedItem : item));
        }
        catch (e) {
            console.error(e);
        }
        finally {
            setEditingItem(null);
        }
    };
    return (React.createElement("div", { className: "menu-view" },
        editingItem && React.createElement(EditMenuItemForm, { item: editingItem, onSave: handleSaveEdit, onCancel: () => setEditingItem(null) }),
        itemToDelete && (React.createElement(ConfirmDeleteModal, { name: itemToDelete.nombre, onConfirm: handleConfirmDelete, onCancel: () => setItemToDelete(null), isDeleting: isDeleting })),
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Men\u00FA"),
            React.createElement("button", { onClick: onAddMenuItem, className: "header-action-button", "aria-label": "A\u00F1adir producto" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })))),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando men\u00FA...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchItems }),
        !isLoading && !error && menuItems.length === 0 && React.createElement("p", { className: "no-admins-message" }, "No hay productos en el men\u00FA. \u00A1A\u00F1ade uno!"),
        !isLoading && !error && menuItems.length > 0 && (React.createElement("div", { className: "menu-grid" }, menuItems.map(item => (React.createElement("div", { key: item.id, className: "menu-card" },
            React.createElement("div", { className: "menu-card-image", style: { backgroundImage: `url(${item.imageUrl || 'https://i.imgur.com/YJkWtS1.jpeg'})` } }),
            React.createElement("div", { className: "menu-card-content" },
                React.createElement("h4", null, item.nombre),
                React.createElement("p", { className: "menu-card-description" }, item.descripcion),
                React.createElement("div", { className: "menu-card-details" },
                    React.createElement("span", null,
                        React.createElement("strong", null, "Precio:"),
                        " ",
                        item.precio,
                        " Bs."),
                    React.createElement("span", null,
                        React.createElement("strong", null, "Disp:"),
                        " ",
                        React.createElement("span", { className: item.disponible === 'Si' ? 'available' : 'unavailable' }, item.disponible)))),
            React.createElement("div", { className: "menu-card-actions" },
                React.createElement("button", { className: "action-button edit-button", onClick: () => setEditingItem(item) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                        React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
                    React.createElement("span", null, "Editar")),
                React.createElement("button", { className: "action-button delete-button", onClick: () => setItemToDelete(item) },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("polyline", { points: "3 6 5 6 21 6" }),
                        React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                        React.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                        React.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" })),
                    React.createElement("span", null, "Eliminar"))))))))));
};
// User Menu View Component (for browsing)
const UserMenuView = ({ onBack, onGoToCart, cart, onAddToCart }) => {
    const [menuItems, setMenuItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const cartItemCount = Object.keys(cart).length;
    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getMenuItemsFromDatabase();
            setMenuItems(response.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar el menú.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchItems();
    }, [fetchItems]);
    return (React.createElement("div", { className: "menu-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Nuestro Men\u00FA"),
            React.createElement("button", { onClick: onGoToCart, className: "header-action-button cart-button", "aria-label": "Ver carrito" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("circle", { cx: "9", cy: "21", r: "1" }),
                    React.createElement("circle", { cx: "20", cy: "21", r: "1" }),
                    React.createElement("path", { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" })),
                cartItemCount > 0 && React.createElement("span", { className: "cart-badge" }, cartItemCount))),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando men\u00FA...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchItems }),
        !isLoading && !error && menuItems.length === 0 && React.createElement("p", { className: "no-admins-message" }, "El men\u00FA est\u00E1 vac\u00EDo por el momento."),
        !isLoading && !error && menuItems.length > 0 && (React.createElement("div", { className: "menu-grid" }, menuItems.map(item => {
            const isInCart = !!cart[item.id];
            return (React.createElement("div", { key: item.id, className: "menu-card" },
                React.createElement("div", { className: "menu-card-image", style: { backgroundImage: `url(${item.imageUrl || 'https://i.imgur.com/YJkWtS1.jpeg'})` } }),
                React.createElement("div", { className: "menu-card-content" },
                    React.createElement("h4", null, item.nombre),
                    React.createElement("p", { className: "menu-card-description" }, item.descripcion),
                    React.createElement("div", { className: "menu-card-details" },
                        React.createElement("span", null,
                            React.createElement("strong", null, "Precio:"),
                            " ",
                            item.precio,
                            " Bs."),
                        React.createElement("span", null,
                            React.createElement("strong", null, "Disp:"),
                            " ",
                            React.createElement("span", { className: item.disponible === 'Si' ? 'available' : 'unavailable' }, item.disponible)))),
                React.createElement("div", { className: "menu-card-actions" }, isInCart ? (React.createElement("button", { className: "action-button added-to-cart-button", disabled: true },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("polyline", { points: "20 6 9 17 4 12" })),
                    React.createElement("span", null, "A\u00F1adido"))) : (React.createElement("button", { className: "action-button add-to-cart-button", onClick: () => onAddToCart(item), disabled: item.disponible !== 'Si' },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                        React.createElement("circle", { cx: "9", cy: "21", r: "1" }),
                        React.createElement("circle", { cx: "20", cy: "21", r: "1" }),
                        React.createElement("path", { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" })),
                    React.createElement("span", null, "A\u00F1adir al carrito"))))));
        })))));
};
// Shopping Cart View Component
const ShoppingCartView = ({ onBack, cart, onUpdateQuantity, onRemoveItem, onCheckout, onPurchaseComplete }) => {
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutStatus, setCheckoutStatus] = useState(null);
    const [checkoutMessage, setCheckoutMessage] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [isQrLoading, setIsQrLoading] = useState(true);
    useEffect(() => {
        const fetchQrCode = async () => {
            try {
                setIsQrLoading(true);
                const response = await getQrCodeFromDatabase();
                setQrCodeUrl(response.data);
            }
            catch (error) {
                console.error("Failed to load QR code image.");
            }
            finally {
                setIsQrLoading(false);
            }
        };
        fetchQrCode();
    }, []);
    const cartItemsArray = Object.values(cart);
    const total = cartItemsArray.reduce((acc, current) => {
        return acc + (parseFloat(current.item.precio) * current.quantity);
    }, 0).toFixed(2);
    const handleCheckout = async () => {
        if (!selectedPaymentMethod)
            return;
        setIsCheckingOut(true);
        setCheckoutStatus(null);
        setCheckoutMessage('');
        try {
            const response = await onCheckout({ items: cartItemsArray, total, paymentMethod: selectedPaymentMethod });
            if (selectedPaymentMethod === 'QR') {
                setCheckoutStatus('success');
                setCheckoutMessage("Pedido registrado. Por favor, escanee el QR para pagar.");
                setTimeout(() => {
                    setShowQrModal(true);
                }, 1500);
            }
            else { // Cash payment
                setCheckoutStatus('success');
                setCheckoutMessage(response.message || "Venta registrada con éxito.");
                setTimeout(() => {
                    onPurchaseComplete();
                }, 2500);
            }
        }
        catch (error) {
            setCheckoutStatus('error');
            setCheckoutMessage(error instanceof Error ? error.message : "Error al procesar la venta.");
        }
        finally {
            setIsCheckingOut(false);
        }
    };
    const handleCloseQrModal = () => {
        setShowQrModal(false);
        onPurchaseComplete();
    };
    return (React.createElement("div", { className: "shopping-cart-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Carrito de Compras")),
        cartItemsArray.length === 0 && !checkoutStatus ? (React.createElement("p", { className: "no-admins-message" }, "Tu carrito est\u00E1 vac\u00EDo.")) : (React.createElement(React.Fragment, null,
            React.createElement("fieldset", { disabled: isCheckingOut || checkoutStatus === 'success' },
                React.createElement("div", { className: "cart-items-list" }, cartItemsArray.map(({ item, quantity }) => (React.createElement("div", { key: item.id, className: "cart-item" },
                    React.createElement("img", { src: item.imageUrl, alt: item.nombre, className: "cart-item-image" }),
                    React.createElement("div", { className: "cart-item-info" },
                        React.createElement("h4", null, item.nombre),
                        React.createElement("p", null,
                            parseFloat(item.precio).toFixed(2),
                            " Bs.")),
                    React.createElement("div", { className: "cart-item-actions" },
                        React.createElement("div", { className: "quantity-selector" },
                            React.createElement("button", { className: "quantity-button", onClick: () => onUpdateQuantity(item.id, quantity - 1), "aria-label": "Quitar uno" },
                                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" },
                                    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" }))),
                            React.createElement("span", { className: "quantity-display", "aria-live": "polite" }, quantity),
                            React.createElement("button", { className: "quantity-button", onClick: () => onUpdateQuantity(item.id, quantity + 1), "aria-label": "A\u00F1adir uno" },
                                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" },
                                    React.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                                    React.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })))),
                        React.createElement("button", { className: "remove-item-button", onClick: () => onRemoveItem(item.id), "aria-label": `Eliminar ${item.nombre}` },
                            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                                React.createElement("polyline", { points: "3 6 5 6 21 6" }),
                                React.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })),
                            React.createElement("span", null, "Eliminar")))))))),
            React.createElement("div", { className: "payment-method-selector" },
                React.createElement("h4", null, "Seleccione un m\u00E9todo de pago"),
                React.createElement("div", { className: "payment-options" },
                    React.createElement("button", { className: `payment-option ${selectedPaymentMethod === 'Efectivo' ? 'selected' : ''}`, onClick: () => setSelectedPaymentMethod('Efectivo'), disabled: isCheckingOut || checkoutStatus === 'success', "aria-pressed": selectedPaymentMethod === 'Efectivo' },
                        React.createElement("span", { className: "payment-icon", "aria-hidden": "true" }, "\uD83D\uDCB5"),
                        React.createElement("span", null, "Efectivo")),
                    React.createElement("button", { className: `payment-option ${selectedPaymentMethod === 'QR' ? 'selected' : ''}`, onClick: () => setSelectedPaymentMethod('QR'), disabled: isCheckingOut || checkoutStatus === 'success' || isQrLoading, "aria-pressed": selectedPaymentMethod === 'QR' },
                        React.createElement("span", { className: "payment-icon", "aria-hidden": "true" }, "\uD83D\uDCF1"),
                        React.createElement("span", null, "QR")))),
            React.createElement("div", { className: "cart-summary" },
                React.createElement("div", { className: "total-row" },
                    React.createElement("span", null, "Total"),
                    React.createElement("span", null,
                        total,
                        " Bs.")),
                checkoutStatus && React.createElement("div", { className: `submission-message ${checkoutStatus}` }, checkoutMessage),
                checkoutStatus !== 'success' && (React.createElement("button", { className: "submit-button checkout-button", onClick: handleCheckout, disabled: isCheckingOut || cartItemsArray.length === 0 || !selectedPaymentMethod }, isCheckingOut ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "spinner" }),
                    React.createElement("span", null, "Procesando..."))) : ('Finalizar Compra')))))),
        showQrModal && (React.createElement("div", { className: "modal-overlay" },
            React.createElement("div", { className: "modal-content qr-modal-content" },
                React.createElement("h3", { className: "main-title" }, "Escanee para Pagar"),
                React.createElement("p", null, "Escanee el c\u00F3digo QR con su aplicaci\u00F3n bancaria para completar la compra."),
                isQrLoading ? React.createElement("div", { className: "loading-container" },
                    React.createElement("div", { className: "spinner-dark" })) :
                    React.createElement("img", { src: qrCodeUrl, alt: "C\u00F3digo QR de pago", className: "qr-image" }),
                React.createElement("button", { onClick: handleCloseQrModal, className: "submit-button" }, "Hecho"))))));
};
// Sales View Component
const SalesView = ({ onBack }) => {
    const [sales, setSales] = useState([]);
    const [filteredSales, setFilteredSales] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    // Filter states
    const [filterType, setFilterType] = useState('all'); // all, day, month, range
    const [filterDate, setFilterDate] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [salesResponse, usersResponse] = await Promise.all([
                getSalesFromDatabase(),
                getUsers()
            ]);
            const sortedSales = salesResponse.data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSales(sortedSales);
            setFilteredSales(sortedSales);
            setUsers(usersResponse.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar los datos de ventas.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    useEffect(() => {
        let newFilteredSales = [...sales];
        if (filterType === 'day' && filterDate) {
            newFilteredSales = sales.filter(sale => new Date(sale.date).toISOString().startsWith(filterDate));
        }
        else if (filterType === 'month' && filterMonth) {
            newFilteredSales = sales.filter(sale => new Date(sale.date).toISOString().startsWith(filterMonth));
        }
        else if (filterType === 'range' && filterStartDate && filterEndDate) {
            const startDate = new Date(filterStartDate);
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(filterEndDate);
            endDate.setUTCHours(23, 59, 59, 999);
            newFilteredSales = sales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= startDate && saleDate <= endDate;
            });
        }
        setFilteredSales(newFilteredSales);
    }, [sales, filterType, filterDate, filterMonth, filterStartDate, filterEndDate]);
    const findUserById = (userId) => {
        if (!userId)
            return null;
        return users.find(u => u.id === userId);
    };
    const handleFilterTypeChange = (e) => {
        setFilterType(e.target.value);
        setFilterDate('');
        setFilterMonth('');
        setFilterStartDate('');
        setFilterEndDate('');
    };
    const clearFilters = () => {
        setFilterType('all');
        setFilterDate('');
        setFilterMonth('');
        setFilterStartDate('');
        setFilterEndDate('');
    };
    const totalSales = filteredSales.reduce((acc, sale) => acc + parseFloat(sale.total), 0).toFixed(2);
    const getFilterTitle = () => {
        if (filterType === 'day' && filterDate) {
            // Adding T00:00:00 to ensure date is interpreted in local timezone for formatting
            return `del día ${new Date(filterDate + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
        if (filterType === 'month' && filterMonth) {
            const [year, month] = filterMonth.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            return `del mes de ${date.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
        }
        if (filterType === 'range' && filterStartDate && filterEndDate) {
            return `del ${new Date(filterStartDate + 'T00:00:00').toLocaleDateString('es-ES')} al ${new Date(filterEndDate + 'T00:00:00').toLocaleDateString('es-ES')}`;
        }
        return 'de todas las ventas';
    };
    return (React.createElement("div", { className: "sales-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Reporte de Ventas")),
        React.createElement("div", { className: "sales-filter-container" },
            React.createElement("div", { className: "filter-group" },
                React.createElement("label", { htmlFor: "filter-type" }, "Filtrar por:"),
                React.createElement("select", { id: "filter-type", value: filterType, onChange: handleFilterTypeChange },
                    React.createElement("option", { value: "all" }, "Todas las ventas"),
                    React.createElement("option", { value: "day" }, "D\u00EDa espec\u00EDfico"),
                    React.createElement("option", { value: "month" }, "Mes espec\u00EDfico"),
                    React.createElement("option", { value: "range" }, "Rango de fechas"))),
            filterType === 'day' && (React.createElement("div", { className: "filter-group" },
                React.createElement("label", { htmlFor: "filter-date" }, "Seleccione el d\u00EDa:"),
                React.createElement("input", { type: "date", id: "filter-date", value: filterDate, onChange: e => setFilterDate(e.target.value) }))),
            filterType === 'month' && (React.createElement("div", { className: "filter-group" },
                React.createElement("label", { htmlFor: "filter-month" }, "Seleccione el mes:"),
                React.createElement("input", { type: "month", id: "filter-month", value: filterMonth, onChange: e => setFilterMonth(e.target.value) }))),
            filterType === 'range' && (React.createElement("div", { className: "filter-group date-range-group" },
                React.createElement("div", null,
                    React.createElement("label", { htmlFor: "filter-start-date" }, "Desde:"),
                    React.createElement("input", { type: "date", id: "filter-start-date", value: filterStartDate, onChange: e => setFilterStartDate(e.target.value) })),
                React.createElement("div", null,
                    React.createElement("label", { htmlFor: "filter-end-date" }, "Hasta:"),
                    React.createElement("input", { type: "date", id: "filter-end-date", value: filterEndDate, onChange: e => setFilterEndDate(e.target.value) })))),
            filterType !== 'all' && (React.createElement("button", { onClick: clearFilters, className: "clear-filter-button" }, "Limpiar Filtro"))),
        !isLoading && !error && sales.length > 0 && (React.createElement("div", { className: "sales-summary-card" },
            React.createElement("h4", null,
                "Total ",
                getFilterTitle()),
            React.createElement("span", { className: "summary-total" },
                totalSales,
                " Bs."))),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando ventas...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchData }),
        !isLoading && !error && filteredSales.length === 0 && (React.createElement("p", { className: "no-admins-message" }, sales.length > 0 ? "No hay ventas que coincidan con su filtro." : "No hay ventas registradas.")),
        !isLoading && !error && filteredSales.length > 0 && (React.createElement("div", { className: "sales-list-container" }, filteredSales.map(sale => {
            const customer = findUserById(sale.userId);
            let items = [];
            try {
                if (sale.items_json && typeof sale.items_json === 'string') {
                    items = JSON.parse(sale.items_json);
                }
            }
            catch (e) {
                console.error(`Error parsing items for sale #${sale.id}:`, sale.items_json);
            }
            return (React.createElement("div", { key: sale.id, className: "sale-card" },
                React.createElement("div", { className: "sale-card-header" },
                    React.createElement("h4", null,
                        "Venta #",
                        sale.id),
                    React.createElement("span", null, new Date(sale.date).toLocaleString('es-ES'))),
                React.createElement("div", { className: "sale-card-customer" },
                    React.createElement("h5", null, "Cliente"),
                    customer ? (React.createElement("p", null,
                        customer.nombres,
                        " ",
                        customer.apellidos,
                        " (",
                        customer.celular,
                        ")")) : (React.createElement("p", null, "Cliente no registrado"))),
                React.createElement("div", { className: "sale-card-payment" },
                    React.createElement("h5", null, "M\u00E9todo de Pago"),
                    React.createElement("p", null, sale.paymentMethod)),
                React.createElement("div", { className: "sale-card-items" },
                    React.createElement("h5", null, "Productos"),
                    React.createElement("ul", null, items.map(({ item, quantity }) => (React.createElement("li", { key: item.id, className: "sale-item" },
                        React.createElement("span", null,
                            quantity,
                            " x ",
                            item.nombre),
                        React.createElement("span", null,
                            (quantity * parseFloat(item.precio)).toFixed(2),
                            " Bs.")))))),
                React.createElement("div", { className: "sale-card-total" },
                    React.createElement("span", null, "Total"),
                    React.createElement("span", null,
                        sale.total,
                        " Bs."))));
        })))));
};
// Admin Panel Component
const AdminPanel = ({ adminData, onLogout, onManageAdmins, onManageUsers, onGoToMenu, onGoToUserMenu, onGoToShoppingCart, onGoToSales, onGoToConfirmSales, onGoToPaymentSettings }) => {
    return (React.createElement("div", { className: "admin-panel-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("h2", { className: "main-title" }, "Panel de Administrador")),
        React.createElement("h3", { className: "admin-welcome-message" },
            "Bienvenido, ",
            adminData.nombres),
        React.createElement("div", { className: "admin-actions-container" },
            React.createElement("button", { className: "admin-action-button", id: "manage-admins-button", onClick: onManageAdmins }, "Administradores"),
            React.createElement("button", { className: "admin-action-button", id: "manage-users-button", onClick: onManageUsers }, "Usuarios Registrados"),
            React.createElement("button", { className: "admin-action-button", id: "shopping-cart-button", onClick: onGoToShoppingCart }, "Carrito de Compra \uD83D\uDED2"),
            React.createElement("button", { className: "admin-action-button", id: "admin-menu-button", onClick: onGoToMenu }, "Registrar Men\u00FA"),
            React.createElement("button", { className: "admin-action-button", id: "user-menu-view-button", onClick: onGoToUserMenu }, "Men\u00FA \uD83C\uDF74"),
            React.createElement("button", { className: "admin-action-button", id: "pending-orders-button", onClick: onGoToConfirmSales }, "Pedidos Pendientes"),
            React.createElement("button", { className: "admin-action-button", id: "sales-button", onClick: onGoToSales }, "Reporte de Ventas"),
            React.createElement("button", { className: "admin-action-button", id: "payment-settings-button", onClick: onGoToPaymentSettings }, "Configuraci\u00F3n de Pagos")),
        React.createElement("button", { onClick: onLogout, className: "submit-button logout-button" },
            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                React.createElement("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
                React.createElement("polyline", { points: "16 17 21 12 16 7" }),
                React.createElement("line", { x1: "21", y1: "12", x2: "9", y2: "12" })),
            React.createElement("span", null, "Cerrar Sesi\u00F3n"))));
};
const NotificationIcon = () => (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("path", { d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" }),
    React.createElement("path", { d: "M13.73 21a2 2 0 0 1-3.46 0" })));
// Notifications View Component
const NotificationsView = ({ onBack, currentUser }) => {
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const fetchAndMarkNotifications = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getUnreadNotificationsForUserFromDatabase(currentUser.id);
            const sorted = response.data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setNotifications(sorted);
            if (sorted.length > 0) {
                await markUserNotificationsAsReadInDatabase(currentUser.id);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar las notificaciones.");
        }
        finally {
            setIsLoading(false);
        }
    }, [currentUser.id]);
    useEffect(() => {
        fetchAndMarkNotifications();
    }, [fetchAndMarkNotifications]);
    return (React.createElement("div", { className: "notifications-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Notificaciones")),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchAndMarkNotifications }),
        !isLoading && !error && notifications.length === 0 && (React.createElement("p", { className: "no-admins-message" }, "No tienes notificaciones nuevas.")),
        !isLoading && !error && notifications.length > 0 && (React.createElement("div", { className: "notifications-list" }, notifications.map(notification => (React.createElement("div", { key: notification.id, className: "notification-item" },
            React.createElement("div", { className: "notification-icon-container" },
                React.createElement(NotificationIcon, null)),
            React.createElement("div", { className: "notification-content" },
                React.createElement("p", { className: "notification-message" }, notification.message),
                React.createElement("span", { className: "notification-date" }, new Date(notification.date).toLocaleString('es-ES'))))))))));
};
// User Panel Component
const UserPanel = ({ userData, onLogout, onGoToUserMenu, onGoToShoppingCart, cart, onGoToPendingSales, onGoToNotifications }) => {
    const cartItemCount = Object.keys(cart).length;
    const [notificationCount, setNotificationCount] = useState(0);
    useEffect(() => {
        const fetchNotificationCount = async () => {
            try {
                const response = await getUnreadNotificationsForUserFromDatabase(userData.id);
                setNotificationCount(response.data.length);
            }
            catch (e) {
                console.error("Failed to fetch notification count");
            }
        };
        fetchNotificationCount();
    }, [userData.id]);
    return (React.createElement("div", { className: "admin-panel-view" },
        " ",
        React.createElement("div", { className: "form-header" },
            React.createElement("h2", { className: "main-title" }, "Portal de Usuario")),
        React.createElement("div", { className: "user-panel-welcome" },
            React.createElement("div", { className: "data-card-avatar" },
                React.createElement(UserIcon, null)),
            React.createElement("h3", { className: "admin-welcome-message" },
                "\u00A1Hola, ",
                userData.nombres,
                " ",
                userData.apellidos,
                "!")),
        React.createElement("p", { className: "user-panel-prompt" }, "\u00BFQu\u00E9 te apetece hoy?"),
        React.createElement("div", { className: "admin-actions-container" },
            React.createElement("button", { className: "admin-action-button", id: "user-menu-view-button", onClick: onGoToUserMenu }, "Ver Men\u00FA \uD83C\uDF74"),
            React.createElement("button", { className: "admin-action-button", id: "shopping-cart-button", onClick: onGoToShoppingCart },
                "Mi Carrito \uD83D\uDED2",
                cartItemCount > 0 && React.createElement("span", { className: "cart-badge-on-button" }, cartItemCount)),
            React.createElement("button", { className: "admin-action-button", id: "my-orders-button", onClick: onGoToPendingSales }, "Mis Pedidos"),
            React.createElement("button", { className: "admin-action-button", id: "notifications-button", onClick: onGoToNotifications },
                React.createElement("span", null, "Notificaciones"),
                React.createElement(NotificationIcon, null),
                notificationCount > 0 && React.createElement("span", { className: "cart-badge-on-button" }, notificationCount))),
        React.createElement("button", { onClick: onLogout, className: "submit-button logout-button" },
            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                React.createElement("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
                React.createElement("polyline", { points: "16 17 21 12 16 7" }),
                React.createElement("line", { x1: "21", y1: "12", x2: "9", y2: "12" })),
            React.createElement("span", null, "Cerrar Sesi\u00F3n"))));
};
// Pending Sales View (for User)
const PendingSalesView = ({ onBack, currentUser }) => {
    const [pendingSales, setPendingSales] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const fetchPendingSales = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getUserPendingSalesFromDatabase(currentUser.id);
            const sortedSales = response.data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setPendingSales(sortedSales);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar tus pedidos pendientes.");
        }
        finally {
            setIsLoading(false);
        }
    }, [currentUser.id]);
    useEffect(() => {
        fetchPendingSales();
    }, [fetchPendingSales]);
    return (React.createElement("div", { className: "sales-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Mis Pedidos")),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando pedidos...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchPendingSales }),
        !isLoading && !error && pendingSales.length === 0 && (React.createElement("p", { className: "no-admins-message" }, "No tienes pedidos pendientes de confirmaci\u00F3n.")),
        !isLoading && !error && pendingSales.length > 0 && (React.createElement("div", { className: "sales-list-container" }, pendingSales.map(sale => {
            let items = [];
            try {
                if (sale.items_json && typeof sale.items_json === 'string') {
                    items = JSON.parse(sale.items_json);
                }
            }
            catch (e) {
                console.error(`Error parsing items for sale #${sale.id}:`, sale.items_json);
            }
            return (React.createElement("div", { key: sale.id, className: "sale-card" },
                React.createElement("div", { className: "sale-card-header" },
                    React.createElement("h4", null,
                        "Pedido #",
                        sale.id),
                    React.createElement("span", null, new Date(sale.date).toLocaleString('es-ES'))),
                React.createElement("div", { className: "sale-card-payment" },
                    React.createElement("h5", null, "M\u00E9todo de Pago"),
                    React.createElement("p", null, sale.paymentMethod)),
                React.createElement("div", { className: "sale-card-items" },
                    React.createElement("h5", null, "Productos"),
                    React.createElement("ul", null, items.map(({ item, quantity }) => (React.createElement("li", { key: item.id, className: "sale-item" },
                        React.createElement("span", null,
                            quantity,
                            " x ",
                            item.nombre),
                        React.createElement("span", null,
                            (quantity * parseFloat(item.precio)).toFixed(2),
                            " Bs.")))))),
                React.createElement("div", { className: "sale-card-total" },
                    React.createElement("span", null, "Total"),
                    React.createElement("span", null,
                        sale.total,
                        " Bs.")),
                React.createElement("div", { className: "sale-card-status" },
                    React.createElement("strong", null, "Estado:"),
                    " ",
                    React.createElement("span", null, "Pendiente"))));
        })))));
};
// Confirm Sales View (for Admin)
const ConfirmSalesView = ({ onBack }) => {
    const [pendingSales, setPendingSales] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null); // To disable buttons during API call
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [salesResponse, usersResponse] = await Promise.all([
                getPendingSalesFromDatabase(),
                getUsers()
            ]);
            const sortedSales = salesResponse.data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setPendingSales(sortedSales);
            setUsers(usersResponse.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos pendientes.");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchData();
    }, [fetchData]);
    const findUserById = (userId) => {
        if (!userId)
            return null;
        return users.find(u => u.id === userId);
    };
    const handleApprove = async (saleId) => {
        setProcessingId(saleId);
        try {
            await approvePendingSale(saleId);
            setPendingSales(prev => prev.filter(s => s.id !== saleId));
        }
        catch (e) {
            console.error("Failed to approve sale:", e);
        }
        finally {
            setProcessingId(null);
        }
    };
    const handleReject = async (saleId) => {
        setProcessingId(saleId);
        try {
            await rejectPendingSale(saleId);
            setPendingSales(prev => prev.filter(s => s.id !== saleId));
        }
        catch (e) {
            console.error("Failed to reject sale:", e);
        }
        finally {
            setProcessingId(null);
        }
    };
    return (React.createElement("div", { className: "sales-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver" },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Pedidos Pendientes")),
        isLoading && React.createElement("div", { className: "loading-container" },
            React.createElement("div", { className: "spinner-dark" }),
            React.createElement("p", null, "Cargando pedidos pendientes...")),
        !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchData }),
        !isLoading && !error && pendingSales.length === 0 && (React.createElement("p", { className: "no-admins-message" }, "No hay pedidos pendientes por confirmar.")),
        !isLoading && !error && pendingSales.length > 0 && (React.createElement("div", { className: "sales-list-container" }, pendingSales.map(sale => {
            const customer = findUserById(sale.userId);
            const isProcessing = processingId === sale.id;
            let items = [];
            try {
                if (sale.items_json && typeof sale.items_json === 'string') {
                    items = JSON.parse(sale.items_json);
                }
            }
            catch (e) {
                console.error(`Error parsing items for sale #${sale.id}:`, sale.items_json);
            }
            return (React.createElement("div", { key: sale.id, className: "sale-card" },
                React.createElement("div", { className: "sale-card-header" },
                    React.createElement("h4", null,
                        "Pedido #",
                        sale.id),
                    React.createElement("span", null, new Date(sale.date).toLocaleString('es-ES'))),
                React.createElement("div", { className: "sale-card-customer" },
                    React.createElement("h5", null, "Cliente"),
                    customer ? (React.createElement("p", null,
                        customer.nombres,
                        " ",
                        customer.apellidos,
                        " (",
                        customer.celular,
                        ")")) : (React.createElement("p", null, "Cliente no registrado"))),
                React.createElement("div", { className: "sale-card-payment" },
                    React.createElement("h5", null, "M\u00E9todo de Pago"),
                    React.createElement("p", null, sale.paymentMethod)),
                React.createElement("div", { className: "sale-card-items" },
                    React.createElement("h5", null, "Productos"),
                    React.createElement("ul", null, items.map(({ item, quantity }) => (React.createElement("li", { key: item.id, className: "sale-item" },
                        React.createElement("span", null,
                            quantity,
                            " x ",
                            item.nombre),
                        React.createElement("span", null,
                            (quantity * parseFloat(item.precio)).toFixed(2),
                            " Bs.")))))),
                React.createElement("div", { className: "sale-card-total" },
                    React.createElement("span", null, "Total"),
                    React.createElement("span", null,
                        sale.total,
                        " Bs.")),
                React.createElement("div", { className: "sale-card-actions" },
                    React.createElement("button", { className: "action-button reject-button", disabled: isProcessing, onClick: () => handleReject(sale.id) }, isProcessing ? React.createElement("div", { className: "spinner" }) : 'Rechazar'),
                    React.createElement("button", { className: "action-button approve-button", disabled: isProcessing, onClick: () => handleApprove(sale.id) }, isProcessing ? React.createElement("div", { className: "spinner" }) : 'Aprobar'))));
        })))));
};
// Payment Settings View (for Admin)
const PaymentSettingsView = ({ onBack }) => {
    const [currentQrUrl, setCurrentQrUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const fetchQr = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getQrCodeFromDatabase();
            setCurrentQrUrl(response.data);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen QR actual.');
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        fetchQr();
    }, [fetchQr]);
    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setImagePreview(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            setSubmissionStatus('error');
            setSubmissionMessage("Por favor, seleccione una imagen para subir.");
            return;
        }
        setIsSubmitting(true);
        setSubmissionStatus(null);
        setSubmissionMessage('');
        try {
            const base64Image = await fileToBase64(selectedFile);
            const response = await saveQrCodeToDatabase(base64Image);
            setSubmissionStatus('success');
            setSubmissionMessage(response.message);
            setCurrentQrUrl(base64Image); // Update displayed QR
            setSelectedFile(null);
            setImagePreview(null);
            setTimeout(() => {
                setSubmissionStatus(null);
            }, 3000);
        }
        catch (error) {
            setSubmissionStatus('error');
            setSubmissionMessage("Error al guardar la imagen QR.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (React.createElement("div", { className: "payment-settings-view" },
        React.createElement("div", { className: "form-header" },
            React.createElement("button", { onClick: onBack, className: "back-button", "aria-label": "Volver", disabled: isSubmitting },
                React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" },
                    React.createElement("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
                    React.createElement("polyline", { points: "12 19 5 12 12 5" }))),
            React.createElement("h2", { className: "main-title" }, "Ajustes de Pago")),
        React.createElement("div", { className: "qr-config-card" },
            React.createElement("h3", null, "Configuraci\u00F3n del C\u00F3digo QR"),
            React.createElement("p", null, "Sube la imagen QR que se mostrar\u00E1 a los clientes al finalizar la compra con este m\u00E9todo de pago."),
            React.createElement("div", { className: "current-qr-section" },
                React.createElement("h4", null, "QR Actual"),
                isLoading && React.createElement("div", { className: "loading-container" },
                    React.createElement("div", { className: "spinner-dark" })),
                !isLoading && error && React.createElement(ErrorDisplay, { message: error, onRetry: fetchQr }),
                !isLoading && !error && currentQrUrl &&
                    React.createElement("img", { src: currentQrUrl, alt: "C\u00F3digo QR de pago actual", className: "current-qr-preview" }),
                !isLoading && !error && !currentQrUrl && React.createElement("p", null, "No hay un c\u00F3digo QR configurado.")),
            React.createElement("form", { className: "user-form", onSubmit: handleSubmit },
                React.createElement("fieldset", { disabled: isSubmitting },
                    React.createElement("div", { className: "form-group image-preview-group" },
                        React.createElement("label", { htmlFor: "qr-image-upload" }, "Subir nuevo QR"),
                        imagePreview && React.createElement("img", { src: imagePreview, alt: "Vista previa del nuevo QR", className: "image-preview" }),
                        React.createElement("input", { type: "file", id: "qr-image-upload", name: "qr-image", accept: "image/*", onChange: handleImageChange }))),
                submissionStatus && React.createElement("div", { className: `submission-message ${submissionStatus}` }, submissionMessage),
                React.createElement("button", { type: "submit", className: "submit-button", disabled: !selectedFile || isSubmitting }, isSubmitting ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "spinner" }),
                    React.createElement("span", null, "Guardando..."))) : ('Guardar Nuevo QR'))))));
};
// Main App Component
const App = () => {
    const [showWelcome, setShowWelcome] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const [view, setView] = useState('main'); // 'main', 'newUser', 'adminLogin', 'adminPanel', 'manageAdmins', 'manageUsers', 'userLogin', 'userPanel', 'menu', 'addMenuItem', 'userMenuView', 'shoppingCart', 'sales', 'pendingSales', 'confirmSales', 'paymentSettings', 'notifications'
    const [currentAdmin, setCurrentAdmin] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [cart, setCart] = useState({});
    const [connectionStatus, setConnectionStatus] = useState({ message: '', type: '', isVisible: false });
    useEffect(() => {
        const showConnectionToast = (message, type) => {
            setConnectionStatus({ message, type, isVisible: true });
            setTimeout(() => {
                setConnectionStatus(prev => (Object.assign(Object.assign({}, prev), { isVisible: false })));
            }, 2000);
        };
        const checkConnection = async () => {
            try {
                await getQrCodeFromDatabase();
                showConnectionToast('Conectado a la base de datos', 'success');
            }
            catch (error) {
                console.error("Connection check failed:", error);
                showConnectionToast('Error de conexión con el servidor', 'error');
            }
        };
        checkConnection();
        const exitTimer = setTimeout(() => setIsExiting(true), 2500);
        const welcomeTimer = setTimeout(() => setShowWelcome(false), 3000);
        return () => {
            clearTimeout(exitTimer);
            clearTimeout(welcomeTimer);
        };
    }, []);
    const handleAdminLoginSuccess = (adminData) => {
        setCurrentAdmin(adminData);
        setView('adminPanel');
    };
    const handleUserLoginSuccess = (userData) => {
        setCurrentUser(userData);
        setView('userPanel');
    };
    const handleAdminLogout = () => {
        setCurrentAdmin(null);
        setView('main');
    };
    const handleUserLogout = () => {
        setCurrentUser(null);
        setView('main');
    };
    const handleNavigate = (newView) => {
        setView(newView);
    };
    const handleAddToCart = (item) => {
        setCart(prev => (Object.assign(Object.assign({}, prev), { [item.id]: { item, quantity: 1 } })));
    };
    const handleUpdateCartQuantity = (itemId, newQuantity) => {
        setCart(prev => {
            const newCart = Object.assign({}, prev);
            if (newCart[itemId]) {
                if (newQuantity > 0) {
                    newCart[itemId].quantity = newQuantity;
                }
                else {
                    delete newCart[itemId];
                }
            }
            return newCart;
        });
    };
    const handleRemoveItemFromCart = (itemId) => {
        setCart(prev => {
            const newCart = Object.assign({}, prev);
            delete newCart[itemId];
            return newCart;
        });
    };
    const handleCheckout = (saleData) => {
        const salePayload = Object.assign(Object.assign({}, saleData), { userId: currentUser ? currentUser.id : (currentAdmin ? null : -1) });
        if (saleData.paymentMethod === 'Efectivo') {
            return confirmSaleImmediatelyInDatabase(salePayload);
        }
        return requestPurchaseInDatabase(salePayload);
    };
    const handlePurchaseComplete = () => {
        setCart({});
        const destination = currentUser ? 'userPanel' : (currentAdmin ? 'adminPanel' : 'main');
        handleNavigate(destination);
    };
    if (showWelcome) {
        return (React.createElement("div", { className: `welcome-container ${isExiting ? 'exiting' : ''}` },
            React.createElement("div", { className: "logo" }, "\uD83D\uDC14"),
            React.createElement("h1", { className: "welcome-title" }, "Pollos EMY")));
    }
    const renderMainView = () => (React.createElement("div", { className: "main-view" },
        React.createElement("div", { className: "main-logo" }, "\uD83D\uDC14"),
        React.createElement("h2", { className: "main-title" }, "Bienvenidos a Pollos EMY"),
        React.createElement("div", { className: "button-container" },
            React.createElement("button", { id: "admin-button", className: "menu-button", onClick: () => handleNavigate('adminLogin') }, "Administraci\u00F3n"),
            React.createElement("button", { id: "user-button", className: "menu-button", onClick: () => handleNavigate('userLogin') }, "Usuario"),
            React.createElement("button", { id: "new-user-button", className: "menu-button", onClick: () => handleNavigate('newUser') }, "Nuevo Usuario"))));
    return (React.createElement("div", { className: "app-container" },
        React.createElement(ConnectionStatusToast, Object.assign({}, connectionStatus)),
        view === 'main' && renderMainView(),
        view === 'newUser' && React.createElement(NewUserForm, { onBack: () => handleNavigate('main') }),
        view === 'adminLogin' && React.createElement(AdminLoginForm, { onBack: () => handleNavigate('main'), onLoginSuccess: handleAdminLoginSuccess }),
        view === 'userLogin' && React.createElement(UserLoginForm, { onBack: () => handleNavigate('main'), onLoginSuccess: handleUserLoginSuccess }),
        view === 'adminPanel' && currentAdmin &&
            React.createElement(AdminPanel, { adminData: currentAdmin, onLogout: handleAdminLogout, onManageAdmins: () => handleNavigate('manageAdmins'), onManageUsers: () => handleNavigate('manageUsers'), onGoToMenu: () => handleNavigate('menu'), onGoToUserMenu: () => handleNavigate('userMenuView'), onGoToShoppingCart: () => handleNavigate('shoppingCart'), onGoToSales: () => handleNavigate('sales'), onGoToConfirmSales: () => handleNavigate('confirmSales'), onGoToPaymentSettings: () => handleNavigate('paymentSettings') }),
        view === 'userPanel' && currentUser &&
            React.createElement(UserPanel, { userData: currentUser, onLogout: handleUserLogout, onGoToUserMenu: () => handleNavigate('userMenuView'), onGoToShoppingCart: () => handleNavigate('shoppingCart'), onGoToPendingSales: () => handleNavigate('pendingSales'), onGoToNotifications: () => handleNavigate('notifications'), cart: cart }),
        view === 'manageAdmins' && React.createElement(ManageAdminsView, { onBack: () => handleNavigate('adminPanel') }),
        view === 'manageUsers' && React.createElement(ManageUsersView, { onBack: () => handleNavigate('adminPanel') }),
        view === 'menu' && React.createElement(MenuView, { onBack: () => handleNavigate('adminPanel'), onAddMenuItem: () => handleNavigate('addMenuItem') }),
        view === 'addMenuItem' && React.createElement(AddMenuFormView, { onBack: () => handleNavigate('menu') }),
        view === 'userMenuView' && (React.createElement(UserMenuView, { onBack: () => handleNavigate(currentUser ? 'userPanel' : (currentAdmin ? 'adminPanel' : 'main')), onGoToCart: () => handleNavigate('shoppingCart'), cart: cart, onAddToCart: handleAddToCart })),
        view === 'shoppingCart' && (React.createElement(ShoppingCartView, { onBack: () => handleNavigate('userMenuView'), cart: cart, onUpdateQuantity: handleUpdateCartQuantity, onRemoveItem: handleRemoveItemFromCart, onCheckout: handleCheckout, onPurchaseComplete: handlePurchaseComplete })),
        view === 'sales' && React.createElement(SalesView, { onBack: () => handleNavigate('adminPanel') }),
        view === 'pendingSales' && currentUser && React.createElement(PendingSalesView, { onBack: () => handleNavigate('userPanel'), currentUser: currentUser }),
        view === 'confirmSales' && React.createElement(ConfirmSalesView, { onBack: () => handleNavigate('adminPanel') }),
        view === 'paymentSettings' && React.createElement(PaymentSettingsView, { onBack: () => handleNavigate('adminPanel') }),
        view === 'notifications' && currentUser && React.createElement(NotificationsView, { onBack: () => handleNavigate('userPanel'), currentUser: currentUser })));
};
const rootEl = document.getElementById('root');
if (rootEl) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(React.StrictMode, null,
        React.createElement(App, null)));
}
else {
    console.error("Fatal: Root element with id 'root' not found in the DOM.");
}
