<template>
  <div>
    <Dialog
      v-model="model"
      :options="{ title: 'Add New Customer', size: 'sm' }"
    >
      <template #body-content>
        <div class="space-y-4">
          <div class="space-y-1">
            <Input
              v-model="state.customer"
              label="Customer Name"
              type="text"
              placeholder="Tesla Inc."
            />
          </div>
          <div v-if="config.customerDoctype === 'HD Customer'" class="space-y-1">
            <Input
              v-model="state.domain"
              label="Domain"
              type="text"
              placeholder="eg: tesla.com, mycompany.com"
            />
          </div>
          <div class="float-right flex space-x-2">
            <Button
              label="Add"
              theme="gray"
              variant="solid"
              @click.prevent="addCustomer"
            />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from "@/stores/config";
import { Dialog, Input, createResource, toast } from "frappe-ui";
import { reactive } from "vue";

const emit = defineEmits(["customerCreated"]);
const model = defineModel<boolean>();
const config = useConfigStore();

const state = reactive({
  customer: "",
  domain: "",
});

const customerResource = createResource({
  url: "frappe.client.insert",
  method: "POST",
  onSuccess: () => {
    state.customer = "";
    state.domain = "";
    toast.success("Customer created");
    emit("customerCreated");
  },
  onError: (err) => {
    toast.error(err.messages?.[0] || "Error creating customer");
  },
});

function addCustomer() {
  if (!state.customer) {
    toast.error("Customer name is required");
    return;
  }
  const doc = {
    doctype: config.customerDoctype,
    customer_name: state.customer,
  };
  if (config.customerDoctype === "HD Customer") {
    doc.domain = state.domain;
  }
  customerResource.submit({ doc });
}
</script>
