import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  getListProductsQueryKey,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  Product,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, PackageSearch, Image as ImageIcon } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  price: z.string().min(1, "Price is required").regex(/^\d+(\.\d{1,2})?$/, "Must be a valid price (e.g. 19.99)"),
  description: z.string().min(1, "Description is required"),
  image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function Products() {
  const { data: products, isLoading } = useListProducts();

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage the products your AI assistant can sell.
          </p>
        </div>
        <ProductDialog />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : !products || products.length === 0 ? (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="size-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <PackageSearch className="size-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No products found</h3>
              <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                Add your first product to give your AI agent something to talk about with your customers.
              </p>
            </div>
            <ProductDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteProduct.mutate(
      { id: product.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product deleted" });
        },
        onError: () => {
          toast({ title: "Error deleting product", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full border-border/50 shadow-sm hover:shadow-md transition-all group">
      <div className="aspect-video bg-muted relative overflow-hidden shrink-0 border-b border-border/50">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ImageIcon className="size-8 opacity-50" />
            <span className="text-xs font-medium uppercase tracking-widest opacity-50">No Image</span>
          </div>
        )}
      </div>
      <CardHeader className="flex-none pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg line-clamp-2 leading-tight">{product.name}</CardTitle>
          <div className="font-bold text-primary whitespace-nowrap bg-primary/10 px-2.5 py-1 rounded-full text-sm">
            ${product.price}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4 flex flex-col">
        <CardDescription className="line-clamp-3 text-sm">
          {product.description}
        </CardDescription>
        <div className="mt-auto pt-6 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ProductDialog product={product} trigger={
            <Button variant="secondary" size="icon" className="size-8 rounded-full">
              <Pencil className="size-3.5" />
            </Button>
          } />
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="size-8 rounded-full">
                <Trash2 className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{product.name}"? This action cannot be undone and your AI agent will no longer know about this product.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleteProduct.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductDialog({ product, trigger }: { product?: Product, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isEditing = !!product;
  
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      price: product?.price || "",
      description: product?.description || "",
      image: product?.image || "",
    },
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isPending = createProduct.isPending || updateProduct.isPending;

  const onSubmit = (values: ProductFormValues) => {
    const data = {
      ...values,
      image: values.image || null,
    };

    if (isEditing && product) {
      updateProduct.mutate(
        { id: product.id, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product updated" });
            setOpen(false);
          },
          onError: () => {
            toast({ title: "Error updating product", variant: "destructive" });
          },
        }
      );
    } else {
      createProduct.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast({ title: "Product created" });
            form.reset();
            setOpen(false);
          },
          onError: () => {
            toast({ title: "Error creating product", variant: "destructive" });
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) form.reset();
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="size-4" />
            Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update your product details." : "Add a new product to your catalog."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mechanical Keyboard" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input placeholder="99.99" className="pl-7" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the product in detail. The AI agent will use this to answer questions." 
                      className="min-h-[100px] resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
