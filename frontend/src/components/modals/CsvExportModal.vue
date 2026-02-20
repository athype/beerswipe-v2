<template>
    <Modal
        :show="show"
        title="Export Users to CSV"
        @close="close"
    >
        <div class="export-content">
            <div class="csv-info">
                <p>Export user data in CSV format compatible with import functionality.</p>
                <p>Format: username, credits, dateOfBirth (DD-MM-YYYY), member (true/false)</p>
                <p><strong>Note:</strong> Only members and non-members will be exported (admin users excluded).</p>
            </div>

            <form @submit.prevent="handleExport">
                <div class="form-group">
                    <label for="exportType">Filter by User Type (optional):</label>
                    <select id="exportType" v-model="exportType" class="form-input">
                        <option value="">All Users (Members & Non-Members)</option>
                        <option value="member">Members Only</option>
                        <option value="non-member">Non-Members Only</option>
                    </select>
                </div>

                <div class="export-info">
                    <p><strong>Total Users:</strong> {{ totalUsers }}</p>
                    <p><strong>File Name:</strong> users-{{ exportType || 'all' }}-export-{{ exportDate }}.csv</p>
                </div>

                <div class="modal-actions">
                    <button type="button" @click="close" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">Export</button>
                </div>
            </form>
        </div>
    </Modal>
</template>

<script setup>
import { computed, ref } from 'vue'
import Modal from '../Modal.vue'

defineProps({
    show: {
        type: Boolean,
        default: false
    },
    totalUsers: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['close', 'export'])

const exportType = ref('')

const exportDate = computed(() => new Date().toISOString().split('T')[0])

const close = () => {
    exportType.value = ''
    emit('close')
}

const handleExport = () => {
    const params = {}
    if (exportType.value) {
        params.type = exportType.value
    }

    emit('export', params)
}
</script>

<style scoped>
.export-content {
    margin-bottom: 1rem;
}

.csv-info {
    background: var(--color-card-bg);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    border: 1px solid #333;
}

.csv-info p {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-light-grey);
}

.form-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e1e1e1;
    border-radius: 6px;
    font-size: 1rem;
    background: var(--color-input-bg);
    color: var(--color-light-grey);
}

.export-info {
    background: var(--color-card-bg);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    border-left: 4px solid var(--green-7);
}

.export-info p {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
}

.modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
}
</style>
