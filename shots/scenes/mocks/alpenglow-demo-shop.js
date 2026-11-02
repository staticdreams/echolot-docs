let orders = []

mock.post("/orders", (req, res) => {
  const order = { id: "ord_" + (orders.length + 1), status: "pending", ...req.json() }
  orders.push(order)
  res.status(201).header("Location", "/v1/orders/" + order.id).json(order)
})

mock.get("/orders/:id", (req, res) => {
  const order = orders.find(o => o.id === req.params.id)
  return order ?? res.status(404).json({ error: "no such order" })
})
