# Order Timeout & Chef Preparation Progress System

## Overview

This system provides automatic timeout management for restaurant orders and their preparation steps. It tracks the progress of each order from creation through various preparation stages and automatically cancels orders if they exceed their timeout period without progress updates.

## Features

### 1. **Order-Level Timeout**

- Each order receives a timeout duration (default: 30 minutes)
- Timer starts when order enters "preparing" status
- If no progress updates occur before timeout, order is automatically cancelled
- Configurable timeout period per order

### 2. **Prep Step Tracking**

- Orders have multiple preparation steps (ingredient prep, cooking, plating, quality check, custom)
- Each step has its own estimated duration and timeout
- Steps can be in states: pending, in-progress, completed, skipped, failed
- Individual step timeouts are tracked separately

### 3. **Automatic Cancellation**

- Orders exceeding timeout are automatically cancelled
- Failed prep steps are marked when they timeout
- Cancellation reason is recorded for audit trail
- Can be disabled per order if needed

### 4. **Timeout Extension**

- Chefs can request additional time before timeout occurs
- Extended time is added to the current timeout
- Updated timeout is tracked in the system

## Database Models

### Order Model (Updated)

```typescript
{
  // ... existing fields ...
  totalPrepTimeoutMinutes?: number;    // Total timeout for prep (in minutes)
  prepStartedAt?: Date;                 // When preparation started
  prepTimeoutAt?: Date;                 // When preparation will timeout
  lastPrepUpdateAt?: Date;              // Last update from chef
  autoCancel?: boolean;                 // Auto-cancel on timeout (default: true)
  cancelledReason?: string;             // Reason for cancellation
}
```

### ChefPrepProgress Model (New)

```typescript
{
  orderId: ObjectId;                    // Reference to Order
  chefId?: ObjectId;                    // Reference to User (chef)
  chefName?: string;                    // Name of chef
  steps: [{
    stepName: string;                   // ingredient_prep, cooking, plating, quality_check, custom
    description?: string;               // Step description
    estimatedDurationMinutes: number;   // Estimated duration
    status: string;                     // pending, in-progress, completed, skipped, failed
    startedAt?: Date;                   // When step started
    completedAt?: Date;                 // When step completed
    timeoutAt?: Date;                   // When step will timeout
    notes?: string;                     // Chef notes
  }];
  overallStatus: string;                // pending, in-progress, completed, cancelled
  totalEstimatedMinutes: number;        // Total estimated prep time
  startedAt?: Date;                     // When prep started
  completedAt?: Date;                   // When prep completed
  cancelledAt?: Date;                   // When cancelled
  cancelReason?: string;                // Reason for cancellation
}
```

## API Endpoints

### 1. Initialize Order Preparation

```
POST /api/order/:orderId/init-prep
Content-Type: application/json

{
  "timeoutMinutes": 30  // Optional, defaults to 30 minutes
}

Response: {
  "message": "Order prep initialized with timeout",
  "order": { ...orderData }
}
```

### 2. Update Prep Step Progress

```
POST /api/order/:orderId/prep-step
Content-Type: application/json

{
  "stepName": "cooking",              // ingredient_prep, cooking, plating, quality_check, custom
  "status": "in-progress",            // pending, in-progress, completed, skipped, failed
  "notes": "Grilling the steak..."    // Optional
}

Response: {
  "message": "Prep step updated",
  "prepProgress": { ...prepProgressData }
}
```

### 3. Get Prep Progress

```
GET /api/order/:orderId/prep-progress

Response: {
  "orderId": "...",
  "steps": [
    {
      "stepName": "cooking",
      "status": "in-progress",
      "startedAt": "2026-06-18T10:30:00Z",
      "timeoutAt": "2026-06-18T10:40:00Z",
      ...
    }
  ],
  "overallStatus": "in-progress",
  ...
}
```

### 4. Get Timeout Status

```
GET /api/order/:orderId/timeout-status

Response: {
  "orderId": "...",
  "status": "preparing",
  "timeoutAt": "2026-06-18T10:50:00Z",
  "timeoutInMinutes": 12,
  "isExpired": false,
  "prepSteps": [
    {
      "name": "cooking",
      "status": "in-progress",
      "timeoutAt": "2026-06-18T10:40:00Z",
      "isExpired": false
    }
  ]
}
```

### 5. Extend Timeout

```
POST /api/order/:orderId/extend-timeout
Content-Type: application/json

{
  "additionalMinutes": 15
}

Response: {
  "message": "Timeout extended by 15 minutes",
  "order": { ...orderData }
}
```

### 6. Manually Cancel Order

```
POST /api/order/:orderId/cancel
Content-Type: application/json

{
  "reason": "Customer requested cancellation"  // Optional
}

Response: {
  "message": "Order cancelled",
  "order": { ...orderData }
}
```

### 7. Trigger Timeout Check (Admin)

```
POST /api/timeout/check-expired

Response: {
  "message": "Timeout check completed",
  "stats": {
    "cancelledOrders": 2,
    "failedSteps": 5
  }
}
```

## Configuration

### Default Settings

- **Default Prep Timeout**: 30 minutes
- **Check Interval**: 60 seconds
- **Auto-cancel Enabled**: true

### Customization

To customize timeout settings, modify the configuration in `OrderTimeoutService`:

```typescript
const orderTimeoutService = new OrderTimeoutService({
  defaultPrepTimeoutMinutes: 30, // Change default timeout
  checkIntervalSeconds: 60, // Change check frequency
  enableAutoCancel: true, // Enable/disable auto-cancel
});
```

## Workflow Example

### 1. Order Created

```
POST /api/orders
→ Creates order with status "pending"
```

### 2. Waiter Confirms Order

```
Order status changes to "confirmed"
```

### 3. Chef Starts Preparation

```
POST /api/order/{orderId}/init-prep
→ Sets status to "preparing"
→ Initializes prep timeout (default 30 min)
→ Creates ChefPrepProgress document
```

### 4. Chef Updates Prep Steps

```
POST /api/order/{orderId}/prep-step
{
  "stepName": "ingredient_prep",
  "status": "in-progress"
}
→ Step timeout starts (default 10 min per step)
```

### 5. Chef Completes Steps

```
POST /api/order/{orderId}/prep-step
{
  "stepName": "ingredient_prep",
  "status": "completed"
}
→ Step marked as complete
→ Next step can begin
```

### 6. If Running Out of Time

```
GET /api/order/{orderId}/timeout-status
→ Returns "timeoutInMinutes": 5

POST /api/order/{orderId}/extend-timeout
{
  "additionalMinutes": 10
}
→ Extends total timeout
```

### 7. Order Ready

```
All steps completed
→ Chef marks final step as "completed"
→ Overall prep status changes to "completed"
→ Order status changes to "ready"
```

### 8. Automatic Cancellation

```
Background process runs every 60 seconds:
- Checks for orders where prepTimeoutAt < now
- Checks for prep steps where timeoutAt < now
- Automatically cancels/marks failed as needed
- Logs all actions
```

## Background Timeout Checker

The system runs a background process every 60 seconds that:

1. **Checks for Expired Orders**
   - Finds orders with status "preparing" that have exceeded timeout
   - Automatically cancels them with reason "Preparation timeout"
   - Respects `autoCancel` setting

2. **Checks for Failed Prep Steps**
   - Finds prep steps with "in-progress" status that have exceeded their timeout
   - Marks them as "failed" with "[TIMEOUT]" note
   - Updates the prep progress document

3. **Logs Activities**
   - All auto-cancellations are logged
   - Failed step counts are recorded

## WebSocket Events

When integrated with the WebSocket server:

```typescript
// Chef updates order status
socket.emit("order_status_update", {
  orderId: "...",
  status: "ready",
});

// Waiter receives update
io.to("waiter").emit("order_updated", {
  orderId: "...",
  status: "ready",
});
```

## Error Handling

The system handles various error scenarios:

- **Order not found**: Returns 404
- **Invalid step status**: Returns 400
- **Missing timeout fields**: Uses defaults
- **Database errors**: Logged and error returned to client

## Best Practices

1. **Always Initialize Prep Before Updating Steps**
   - Call `/init-prep` before updating any prep steps
   - This ensures proper timeout tracking

2. **Update Progress Regularly**
   - Send updates every 5-10 minutes at minimum
   - Frequent updates prevent accidental timeouts

3. **Request Extension Early**
   - Monitor remaining time via `/timeout-status`
   - Request extension when 5-10 minutes remain
   - Don't wait until the last minute

4. **Monitor Prep Progress**
   - Check `/prep-progress` regularly
   - Identify bottleneck steps
   - Plan accordingly for complex orders

5. **Handle Failures Gracefully**
   - If a step fails, mark it as "failed" or "skipped"
   - Add notes explaining why
   - Request timeout extension if needed

## Performance Considerations

- **Indexes**: Automatically created on frequently queried fields
  - `Order`: status, prepTimeoutAt
  - `ChefPrepProgress`: orderId, overallStatus, createdAt

- **Background Checker**: Runs every 60 seconds with minimal overhead
  - Uses indexed queries
  - Processes failed orders/steps in batches

- **Real-time Updates**: WebSocket integration for instant notifications
  - No polling required on client side
  - Immediate updates to all connected clients

## Future Enhancements

- [ ] SMS/Push notifications for timeout warnings
- [ ] Per-item prep tracking (item-level timeouts)
- [ ] Prep history and analytics
- [ ] Chef performance metrics based on timeout events
- [ ] Automatic escalation to managers
- [ ] Dynamic timeout adjustment based on order complexity

## Troubleshooting

### Orders Not Auto-Cancelling

- Check that `autoCancel` is true on the order
- Verify background service is running: check logs for "timeout checker started"
- Check that order status is "preparing"
- Verify `prepTimeoutAt` is set and in the past

### Timeout Checker Not Running

- Ensure server initialization completes successfully
- Check server logs during startup
- Verify MongoDB connection is active
- Check that `startTimeoutChecker()` is called

### Wrong Timeout Duration

- Verify you're passing correct `timeoutMinutes` parameter
- Check default configuration if not specified
- Remember it's in minutes, not milliseconds

## Security Notes

- Timeout check endpoint (`/api/timeout/check-expired`) should be restricted to admin users
- Consider adding authentication middleware to timeout routes
- Log all timeout-related operations for audit trails
- Validate all input parameters (orderId format, numeric values, etc.)
