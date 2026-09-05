/**
 * One import for the form primitives:
 *
 * ```tsx
 * const create = useApiForm({ schema, defaultValues, submit, fields: DEPARTMENT_FIELDS });
 * <Form api={create}>
 *   <Field name="departmentName" label="Name" required>
 *     {(control) => <Input {...control} {...create.form.register("departmentName")} />}
 *   </Field>
 *   <FormActions>
 *     <SubmitButton pending={create.isSubmitting}>Create</SubmitButton>
 *   </FormActions>
 * </Form>
 * ```
 */

export { Field, type FieldControlProps } from "./field";
export { Form, FormActions, FormBanner, FormGrid, SubmitButton } from "./form";
export { useApiForm, type ApiForm, type ApiFormOptions } from "./use-api-form";
