const express = require("express");
const { createContact, getContacts } = require("../controllers/contactController");

const router = express.Router();

router.post("/create", createContact);
router.get("/get", getContacts);

module.exports = router;